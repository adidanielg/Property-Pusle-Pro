const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const { requireAuth }     = require('../middleware/authMiddleware');
const supabase            = require('../services/supabaseClient');
const notificationService = require('../services/notificationService');
const ticketService        = require('../services/ticketService');
const { validate, schemas }   = require('../middleware/validate');
const { checkPropiedadLimit, checkTicketLimit, getSiguientePlan } = require('../services/planLimits');

const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth(['cliente']));

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const id = req.user.id;

        const { data: clienteInfo } = await supabase
            .from('companias')
            .select('tipo_cliente, nombre_empresa, nombre_contacto')
            .eq('id', id).single();
        const tipoCliente = clienteInfo?.tipo_cliente || 'Individual';

        const [{ data: propiedades }, { data: tickets }, { data: misCalificaciones }, { data: todosTickets }] = await Promise.all([
            supabase.from('propiedades').select('*').eq('compania_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('tickets').select('*, propiedades(direccion), tecnicos:tecnico_asignado(nombre)').eq('cliente_id', id).neq('estado','cancelado').is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('calificaciones').select('ticket_id').eq('cliente_id', id),
            supabase.from('tickets').select('id, estado, categoria, created_at, tecnicos:tecnico_asignado(nombre)').eq('cliente_id', id).is('deleted_at', null).order('created_at', { ascending: false }).limit(200)
        ]);

        const ticketsCalificados = new Set((misCalificaciones || []).map(c => c.ticket_id));
        const completados = (todosTickets || []).filter(t => t.estado === 'completado');

        // Técnico favorito
        const tecCount = {};
        completados.forEach(t => { const n = t.tecnicos?.nombre; if (n) tecCount[n] = (tecCount[n] || 0) + 1; });
        const tecFavorito = Object.keys(tecCount).length > 0
            ? Object.entries(tecCount).sort((a, b) => b[1] - a[1])[0][0] : null;

        // Categoría más frecuente
        const catCount = {};
        (todosTickets || []).forEach(t => { if (t.categoria) catCount[t.categoria] = (catCount[t.categoria] || 0) + 1; });
        const categoriaMasFrecuente = Object.keys(catCount).length > 0
            ? Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0] : null;

        // Tickets por mes (últimos 6 meses)
        const ticketsPorMes = {};
        const hoy = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
            const key = d.toLocaleDateString('es', { month: 'short', year: '2-digit' });
            ticketsPorMes[key] = 0;
        }
        (todosTickets || []).forEach(t => {
            const d = new Date(t.created_at);
            const key = d.toLocaleDateString('es', { month: 'short', year: '2-digit' });
            if (Object.prototype.hasOwnProperty.call(ticketsPorMes, key)) ticketsPorMes[key]++;
        });

        res.render('dashboardCliente.html', {
            title:       'Mi Panel | PropertyPulse',
            cliente:     { ...req.user, tipo_cliente: tipoCliente, nombre_empresa: clienteInfo?.nombre_empresa },
            propiedades: propiedades || [],
            tickets:     tickets     || [],
            ticketsCalificados,
            metricas: {
                totalCompletados:      completados.length,
                tecFavorito,
                categoriaMasFrecuente,
                ticketsPorMes:         JSON.stringify(ticketsPorMes)
            }
        });
    } catch (err) {
        console.error('[CLIENT DASHBOARD]', err);
        res.status(500).send('Error cargando el panel');
    }
});
// ── Crear ticket → notificar técnicos ─────────────────────────
router.post('/tickets', upload.single('foto'), validate(schemas.crearTicket), async (req, res) => {
    try {
        const { propiedad_id, categoria, motivo, descripcion } = req.body;

        // ── Verificar ownership de la propiedad ───────────────
        const { data: propCheck } = await supabase
            .from('propiedades').select('id')
            .eq('id', propiedad_id).eq('compania_id', req.user.id)
            .is('deleted_at', null).maybeSingle();
        if (!propCheck) return res.status(403).json({ error: 'No tienes permiso para crear tickets en esta propiedad' });

        // ── Verificar límite de tickets del plan ──────────────
        const limitCheck = await checkTicketLimit(req.user.id);
        if (!limitCheck.allowed) {
            return res.status(403).json({
                error:       'limit_reached',
                message:     `Tu plan permite ${limitCheck.limite} tickets activos. Ya tienes ${limitCheck.actual}.`,
                upgrade_to:  getSiguientePlan(limitCheck.plan),
                limit_type:  'tickets'
            });
        }
        let foto_url = null;

        if (req.file) {
            const ext      = req.file.mimetype.split('/')[1];
            const fileName = `ticket-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage
                .from('tickets-fotos')
                .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

            if (!upErr) {
                const { data: urlData } = supabase.storage
                    .from('tickets-fotos')
                    .getPublicUrl(fileName);
                foto_url = urlData.publicUrl;
            }
        }

        const { data: ticket, error } = await supabase
            .from('tickets')
            .insert([{ propiedad_id, cliente_id: req.user.id, motivo, descripcion, categoria, estado: 'pendiente', foto_url }])
            .select('*, propiedades(direccion), tecnicos:tecnico_asignado(nombre)')
            .single();

        if (error) throw error;

        notificationService.notificarTecnicos(ticket)
            .catch(err => console.error('[PUSH técnicos]', err.message));

        // Notificar técnicos disponibles por email
        ticketService.notificarTecnicosNuevoTicket(
            ticket,
            ticket.propiedades?.direccion || '',
            ticket.companias?.nombre_contacto || ticket.companias?.nombre_empresa || ''
        ).catch(err => console.error('[EMAIL técnicos]', err.message));

        res.status(201).json({ success: true, ticket });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Calificar técnico ─────────────────────────────────────────
router.post('/calificar', validate(schemas.calificar), async (req, res) => {
    try {
        const { ticket_id, estrellas, comentario } = req.body;

        // Verificar que el ticket pertenece a este cliente y está completado
        const { data: ticket, error: tErr } = await supabase
            .from('tickets')
            .select('id, cliente_id, tecnico_asignado, estado')
            .eq('id', ticket_id)
            .eq('cliente_id', req.user.id)
            .eq('estado', 'completado')
            .single();

        if (tErr || !ticket)
            return res.status(403).json({ error: 'Ticket no válido para calificar' });

        if (!ticket.tecnico_asignado)
            return res.status(400).json({ error: 'Este ticket no tiene técnico asignado' });

        // Insertar calificación (UNIQUE en ticket_id previene duplicados)
        const { data, error } = await supabase
            .from('calificaciones')
            .insert([{
                ticket_id,
                cliente_id: req.user.id,
                tecnico_id: ticket.tecnico_asignado,
                estrellas:  parseInt(estrellas),
                comentario: comentario || null
            }])
            .select().single();

        if (error) {
            if (error.code === '23505')
                return res.status(400).json({ error: 'Ya calificaste este servicio' });
            throw error;
        }

        res.json({ success: true, calificacion: data });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Propiedades CRUD ──────────────────────────────────────────
router.post('/propiedades', validate(schemas.crearPropiedad), async (req, res) => {
    try {
        const { direccion, servicios_contratados } = req.body;

        // ── Verificar suscripción y límite de propiedades ──────
        const limitCheck = await checkPropiedadLimit(req.user.id);
        if (!limitCheck.allowed) {
            // Sin suscripción activa — mostrar modal de planes
            if (limitCheck.no_plan) {
                return res.status(403).json({
                    error:   'no_plan',
                    message: 'Necesitas un plan activo para agregar propiedades.',
                    plan:    limitCheck.plan
                });
            }
            return res.status(403).json({
                error:       'limit_reached',
                message:     `Tu plan permite ${limitCheck.limite} propiedades. Ya tienes ${limitCheck.actual}.`,
                upgrade_to:  getSiguientePlan(limitCheck.plan),
                limit_type:  'propiedades'
            });
        }

        const { data, error } = await supabase
            .from('propiedades')
            .insert([{ direccion, servicios_contratados, compania_id: req.user.id }])
            .select().single();
        if (error) throw error;
        res.json({ success: true, propiedad: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/propiedades/:id', async (req, res) => {
    try {
        const { direccion, servicios_contratados } = req.body;
        const { data, error } = await supabase
            .from('propiedades')
            .update({ direccion, servicios_contratados })
            .eq('id', req.params.id)
            .eq('compania_id', req.user.id)
            .is('deleted_at', null)
            .select().single();
        if (error) throw error;
        res.json({ success: true, propiedad: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/propiedades/:id', async (req, res) => {
    try {
        // Soft delete
        const { error } = await supabase
            .from('propiedades')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .eq('compania_id', req.user.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── Perfil: obtener datos actuales ───────────────────────────
router.get('/perfil', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('companias')
            .select('id, nombre_contacto, nombre_empresa, email, telefono, tipo_cliente')
            .eq('id', req.user.id)
            .single();
        if (error) throw error;
        res.json({ success: true, perfil: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Perfil: actualizar datos ──────────────────────────────────
router.put('/perfil', validate(schemas.perfilCliente), async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const { nombre_contacto, nombre_empresa, email, telefono, password, nueva_password } = req.body;

        // Verificar contraseña actual si quiere cambiarla
        if (nueva_password) {
            const { data: user } = await supabase
                .from('companias').select('password').eq('id', req.user.id).single();
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
        }

        const updates = { nombre_contacto, nombre_empresa, email, telefono };
        if (nueva_password) {
            updates.password = await bcrypt.hash(nueva_password, 10);
        }

        const { data, error } = await supabase
            .from('companias')
            .update(updates)
            .eq('id', req.user.id)
            .select('id, nombre_contacto, nombre_empresa, email, telefono, tipo_cliente')
            .single();

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Ese email ya está en uso' });
            throw error;
        }
        res.json({ success: true, perfil: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Limits: uso del plan actual ───────────────────────────────
router.get('/limits', async (req, res) => {
    try {
        const { getLimits } = require('../services/planLimits');
        const data = await getLimits(req.user.id);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Cancelar ticket (cliente) ─────────────────────────────────
// BUG FIXES: campo correcto es 'cliente_id' (no 'compania_id'),
//            'tecnico_asignado' (no 'tecnico_id'), 'motivo' (no 'titulo')
//            y push_subscription está en tabla tecnicos directamente
router.post('/tickets/:id/cancelar', validate(schemas.cancelarTicket), async (req, res) => {
    try {
        const { motivo } = req.body;

        // CORRECTO: la columna es cliente_id, no compania_id
        const { data: ticket } = await supabase
            .from('tickets')
            .select('id, motivo, categoria, tecnico_asignado, cliente_id')
            .eq('id', req.params.id)
            .eq('cliente_id', req.user.id)   // ← fix: cliente_id
            .single();

        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

        // Solo cancelar si está pendiente o en proceso
        await supabase.from('tickets')
            .update({ estado: 'cancelado' })
            .eq('id', ticket.id);

        // Log de cancelación
        const { data: cliente } = await supabase
            .from('companias').select('nombre_contacto').eq('id', req.user.id).single();

        await supabase.from('cancelaciones').insert({
            ticket_id:      ticket.id,
            cancelado_por:  'cliente',
            usuario_id:     req.user.id,
            usuario_nombre: cliente?.nombre_contacto || 'Cliente',
            motivo:         motivo || 'Sin motivo',
            categoria:      ticket.categoria,
            titulo:         ticket.motivo  // ← fix: motivo (no titulo)
        });

        // Notificar al técnico si estaba asignado
        // CORRECTO: push_subscription está directamente en la tabla tecnicos
        if (ticket.tecnico_asignado) {  // ← fix: tecnico_asignado (no tecnico_id)
            notificationService.notificarCliente(ticket.tecnico_asignado, 'cancelado', {
                motivo: ticket.motivo
            }).catch(() => {});

            // Envío directo de push al técnico usando su push_subscription
            const { data: tec } = await supabase
                .from('tecnicos')
                .select('push_subscription')
                .eq('id', ticket.tecnico_asignado)
                .single();

            if (tec?.push_subscription) {
                const webpush = require('web-push');
                webpush.setVapidDetails(
                    'mailto:admin@propertypulse.com',
                    process.env.VAPID_PUBLIC_KEY,
                    process.env.VAPID_PRIVATE_KEY
                );
                webpush.sendNotification(
                    JSON.parse(tec.push_subscription),
                    JSON.stringify({
                        title: '❌ Ticket cancelado',
                        body:  `El cliente canceló: ${ticket.motivo}`,
                        url:   '/tecnico/dashboard'
                    })
                ).catch(() => {});
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Chat: obtener mensajes ────────────────────────────────────
router.get('/tickets/:id/mensajes', async (req, res) => {
    try {
        // Verificar que el ticket pertenece a este cliente
        const { data: ticket } = await supabase
            .from('tickets').select('id').eq('id', req.params.id).eq('cliente_id', req.user.id).single();
        if (!ticket) return res.status(403).json({ error: 'No autorizado' });

        const { data } = await supabase
            .from('ticket_mensajes')
            .select('*')
            .eq('ticket_id', req.params.id)
            .order('created_at', { ascending: true });
        res.json({ success: true, mensajes: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Chat: enviar mensaje ──────────────────────────────────────
router.post('/tickets/:id/mensajes', validate(schemas.mensajeChat), async (req, res) => {
    try {
        const { mensaje } = req.body;
        if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

        // Verificar que el ticket pertenece a este cliente
        const { data: ticket } = await supabase
            .from('tickets').select('id').eq('id', req.params.id).eq('cliente_id', req.user.id).single();
        if (!ticket) return res.status(403).json({ error: 'No autorizado' });

        const { data: cliente } = await supabase
            .from('companias').select('nombre_contacto').eq('id', req.user.id).single();

        const { data } = await supabase.from('ticket_mensajes').insert({
            ticket_id:    req.params.id,
            autor_id:     req.user.id,
            autor_nombre: cliente?.nombre_contacto || 'Cliente',
            autor_rol:    'cliente',
            mensaje:      mensaje.trim()
        }).select().single();

        res.json({ success: true, mensaje: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Eliminar cuenta (CCPA / derecho al olvido) ────────────────
router.delete('/cuenta', async (req, res) => {
    try {
        const id = req.user.id;
        // Soft delete de propiedades y tickets
        await supabase.from('propiedades').update({ deleted_at: new Date().toISOString() }).eq('compania_id', id);
        await supabase.from('tickets').update({ deleted_at: new Date().toISOString() }).eq('cliente_id', id);
        // Limpiar push subscription
        await supabase.from('companias').update({ push_subscription: null }).eq('id', id);
        // Eliminar la compañía (cuenta)
        await supabase.from('companias').delete().eq('id', id);
        // Limpiar cookie
        res.clearCookie('jwt');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Cotizaciones: ver las del ticket ─────────────────────────
router.get('/tickets/:id/cotizaciones', async (req, res) => {
    try {
        // Verificar ownership del ticket
        const { data: ticket } = await supabase
            .from('tickets').select('id').eq('id', req.params.id).eq('cliente_id', req.user.id).single();
        if (!ticket) return res.status(403).json({ error: 'No autorizado' });

        const { data } = await supabase
            .from('cotizaciones')
            .select('*, tecnicos:tecnico_id(nombre, especialidad)')
            .eq('ticket_id', req.params.id)
            .order('created_at', { ascending: false });

        res.json({ success: true, cotizaciones: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Cotizaciones: aprobar ─────────────────────────────────────
router.post('/cotizaciones/:id/aprobar', async (req, res) => {
    try {
        // Verificar que la cotización pertenece a este cliente
        const { data: cot } = await supabase
            .from('cotizaciones')
            .select('*, tickets(id, motivo)')
            .eq('id', req.params.id)
            .eq('cliente_id', req.user.id)
            .eq('estado', 'pendiente')
            .single();

        if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });

        // Aprobar cotización y activar ticket
        await supabase.from('cotizaciones')
            .update({ estado: 'aprobada', respondida_at: new Date().toISOString() })
            .eq('id', req.params.id);

        // Rechazar automáticamente otras cotizaciones del mismo ticket
        await supabase.from('cotizaciones')
            .update({ estado: 'rechazada', motivo_rechazo: 'Cliente aprobó otra cotización' })
            .eq('ticket_id', cot.ticket_id)
            .neq('id', req.params.id)
            .eq('estado', 'pendiente');

        // Pasar ticket a en_proceso
        await supabase.from('tickets')
            .update({ estado: 'en_proceso', tecnico_asignado: cot.tecnico_id })
            .eq('id', cot.ticket_id);

        // Notificar al técnico
        const notificationService = require('../services/notificationService');
        const { data: tec } = await supabase
            .from('tecnicos').select('push_subscription, nombre').eq('id', cot.tecnico_id).single();

        if (tec?.push_subscription) {
            const webpush = require('web-push');
            webpush.setVapidDetails('mailto:admin@propertypulse.com',
                process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
            webpush.sendNotification(JSON.parse(tec.push_subscription), JSON.stringify({
                title: '✅ Cotización aprobada',
                body:  `El cliente aprobó tu cotización para: ${cot.tickets?.motivo}`,
                url:   '/tecnico/dashboard'
            })).catch(() => {});
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[APROBAR COT]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Cotizaciones: rechazar ────────────────────────────────────
router.post('/cotizaciones/:id/rechazar', async (req, res) => {
    try {
        const { motivo } = req.body;

        const { data: cot } = await supabase
            .from('cotizaciones')
            .select('*, tickets(id, motivo)')
            .eq('id', req.params.id)
            .eq('cliente_id', req.user.id)
            .eq('estado', 'pendiente')
            .single();

        if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });

        // Rechazar cotización
        await supabase.from('cotizaciones')
            .update({
                estado: 'rechazada',
                motivo_rechazo: motivo || 'Sin motivo',
                respondida_at:  new Date().toISOString()
            })
            .eq('id', req.params.id);

        // Si no hay más cotizaciones pendientes, regresar ticket a pendiente
        const { count } = await supabase.from('cotizaciones')
            .select('*', { count: 'exact', head: true })
            .eq('ticket_id', cot.ticket_id)
            .eq('estado', 'pendiente');

        if (!count || count === 0) {
            await supabase.from('tickets')
                .update({ estado: 'pendiente', tecnico_asignado: null })
                .eq('id', cot.ticket_id);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[RECHAZAR COT]', err.message);
        res.status(500).json({ error: err.message });
    }
});


// ── Historial: ticket individual con mensajes ────────────────
router.get('/tickets/:id/historial', async (req, res) => {
    try {
        // Verificar ownership
        const { data: ticket } = await supabase
            .from('tickets')
            .select('*, propiedades(direccion), tecnicos:tecnico_asignado(nombre)')
            .eq('id', req.params.id)
            .eq('cliente_id', req.user.id)
            .single();

        if (!ticket) return res.status(403).json({ error: 'No autorizado' });

        // Mensajes del chat
        const { data: mensajes } = await supabase
            .from('ticket_mensajes')
            .select('autor_nombre, autor_rol, mensaje, created_at')
            .eq('ticket_id', req.params.id)
            .order('created_at', { ascending: true });

        res.json({ success: true, ticket, mensajes: mensajes || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Historial: todos los tickets del cliente ──────────────────
router.get('/historial', async (req, res) => {
    try {
        const { data: tickets } = await supabase
            .from('tickets')
            .select('id, motivo, estado, categoria, foto_url, created_at, propiedades(direccion), tecnicos:tecnico_asignado(nombre)')
            .eq('cliente_id', req.user.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(100);

        res.json({ success: true, tickets: tickets || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Marketplace: lista de técnicos ───────────────────────────
router.get('/tecnicos', async (req, res) => {
    try {
        const { data: tecnicos } = await supabase
            .from('tecnicos')
            .select('id, nombre, especialidad, ocupado, trabajos_completados, activo')
            .eq('activo', true)
            .is('deleted_at', null)
            .order('trabajos_completados', { ascending: false });

        const { data: calificaciones } = await supabase
            .from('calificaciones')
            .select('tecnico_id, estrellas');

        // Calcular promedio y total por técnico
        const statsMap = {};
        (calificaciones || []).forEach(c => {
            if (!statsMap[c.tecnico_id]) statsMap[c.tecnico_id] = { suma: 0, total: 0 };
            statsMap[c.tecnico_id].suma  += c.estrellas;
            statsMap[c.tecnico_id].total += 1;
        });

        const tecnicosConStats = (tecnicos || []).map(t => ({
            ...t,
            promedio:   statsMap[t.id] ? (statsMap[t.id].suma / statsMap[t.id].total).toFixed(1) : null,
            totalCalif: statsMap[t.id]?.total || 0
        }));

        // Ordenar: disponibles primero, luego por rating
        tecnicosConStats.sort((a, b) => {
            if (a.ocupado !== b.ocupado) return a.ocupado ? 1 : -1;
            return (b.promedio || 0) - (a.promedio || 0);
        });

        res.json({ success: true, tecnicos: tecnicosConStats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Marketplace: reseñas de un técnico ───────────────────────
router.get('/tecnicos/:id/resenas', async (req, res) => {
    try {
        const { data } = await supabase
            .from('calificaciones')
            .select('estrellas, comentario, created_at')
            .eq('tecnico_id', req.params.id)
            .order('created_at', { ascending: false })
            .limit(10);

        res.json({ success: true, reseñas: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Reporte PDF mensual ───────────────────────────────────────
router.get('/reporte-pdf', async (req, res) => {
    try {
        const id  = req.user.id;
        const mes = parseInt(req.query.mes) || new Date().getMonth() + 1;
        const año = parseInt(req.query.año) || new Date().getFullYear();
        const inicio = new Date(año, mes - 1, 1).toISOString();
        const fin    = new Date(año, mes, 0, 23, 59, 59).toISOString();

        const { data: clienteInfo } = await supabase
            .from('companias').select('nombre_contacto, nombre_empresa, email, tipo_cliente')
            .eq('id', id).single();

        const { data: tickets } = await supabase
            .from('tickets')
            .select('*, propiedades(direccion), tecnicos:tecnico_asignado(nombre)')
            .eq('cliente_id', id).gte('created_at', inicio).lte('created_at', fin)
            .is('deleted_at', null).order('created_at', { ascending: false });

        const nombreCliente = clienteInfo?.tipo_cliente === 'Compania'
            ? clienteInfo.nombre_empresa : clienteInfo?.nombre_contacto || 'Cliente';
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const nombreMes = meses[mes - 1];
        const lista       = tickets || [];
        const completados = lista.filter(t => t.estado === 'completado').length;
        const pendientes  = lista.filter(t => t.estado === 'pendiente').length;
        const enProceso   = lista.filter(t => t.estado === 'en_proceso').length;

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="reporte-${nombreMes}-${año}.pdf"`);
        doc.pipe(res);

        doc.fontSize(22).font('Helvetica-Bold').fillColor('#7c6dfa').text('Property', 50, 50, { continued: true }).fillColor('#1a1a2e').text('Pulse');
        doc.fontSize(10).font('Helvetica').fillColor('#888888').text('getpropertypulse.net', 50, 78);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a2e').text(nombreCliente, 400, 50, { align: 'right', width: 145 });
        doc.fontSize(9).font('Helvetica').fillColor('#888888')
           .text(clienteInfo?.email || '', 400, 65, { align: 'right', width: 145 })
           .text(`Generado: ${new Date().toLocaleDateString('es')}`, 400, 78, { align: 'right', width: 145 });
        doc.moveTo(50, 100).lineTo(562, 100).strokeColor('#7c6dfa').lineWidth(2).stroke();
        doc.moveDown(1.5);
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a1a2e').text(`Reporte Mensual — ${nombreMes} ${año}`, 50);
        doc.fontSize(10).font('Helvetica').fillColor('#888888').text('Resumen de tickets de mantenimiento del período');
        doc.moveDown(1.5);

        const statY = doc.y;
        const stats = [
            { label: 'Total', value: lista.length, color: '#7c6dfa' },
            { label: 'Completados', value: completados, color: '#10b981' },
            { label: 'En proceso',  value: enProceso,   color: '#3b82f6' },
            { label: 'Pendientes',  value: pendientes,  color: '#f59e0b' }
        ];
        stats.forEach((s, i) => {
            const x = 50 + i * 125;
            doc.roundedRect(x, statY, 115, 65, 8).fillColor('#f8f7ff').fill()
               .roundedRect(x, statY, 115, 65, 8).strokeColor('#e8e6ff').lineWidth(1).stroke();
            doc.fontSize(28).font('Helvetica-Bold').fillColor(s.color).text(String(s.value), x, statY + 10, { width: 115, align: 'center' });
            doc.fontSize(9).font('Helvetica').fillColor('#888888').text(s.label, x, statY + 44, { width: 115, align: 'center' });
        });
        doc.moveDown(5.5);
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a2e').text('DETALLE DE TICKETS', 50);
        doc.moveDown(0.4);

        if (!lista.length) {
            doc.fontSize(10).font('Helvetica').fillColor('#aaaaaa').text('No hay tickets para este período.', 50, doc.y + 10, { align: 'center', width: 512 });
        } else {
            const tableTop = doc.y;
            const cols = [
                { label: 'Motivo',    x: 50,  w: 145 },
                { label: 'Categoría', x: 200, w: 110 },
                { label: 'Técnico',   x: 315, w: 95  },
                { label: 'Estado',    x: 415, w: 80  },
                { label: 'Fecha',     x: 500, w: 62  }
            ];
            doc.roundedRect(50, tableTop, 512, 22, 4).fillColor('#7c6dfa').fill();
            cols.forEach(col => { doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff').text(col.label, col.x, tableTop + 7, { width: col.w }); });
            const eColor = { pendiente:'#f59e0b', en_proceso:'#3b82f6', completado:'#10b981', cancelado:'#6b7280' };
            const eLabel = { pendiente:'Pendiente', en_proceso:'En proceso', completado:'Completado', cancelado:'Cancelado' };
            lista.forEach((t, i) => {
                const rowY = tableTop + 22 + i * 24;
                if (rowY > 700) doc.addPage();
                doc.rect(50, rowY, 512, 24).fillColor(i % 2 === 0 ? '#ffffff' : '#fafaf8').fill();
                [
                    { x:50,  w:145, text:(t.motivo||'').substring(0,22),             color:'#1a1a2e', bold:false },
                    { x:200, w:110, text:(t.categoria||'—').substring(0,16),          color:'#555555', bold:false },
                    { x:315, w:95,  text:(t.tecnicos?.nombre||'—').substring(0,13),   color:'#555555', bold:false },
                    { x:415, w:80,  text:eLabel[t.estado]||t.estado,                  color:eColor[t.estado]||'#555', bold:true },
                    { x:500, w:62,  text:new Date(t.created_at).toLocaleDateString('es',{day:'numeric',month:'short'}), color:'#888888', bold:false }
                ].forEach(cell => {
                    doc.fontSize(8).font(cell.bold?'Helvetica-Bold':'Helvetica').fillColor(cell.color).text(cell.text, cell.x, rowY + 8, { width: cell.w });
                });
                doc.moveTo(50, rowY+24).lineTo(562, rowY+24).strokeColor('#f0f0f8').lineWidth(0.5).stroke();
            });
        }
        doc.fontSize(9).font('Helvetica').fillColor('#bbbbbb').text(`PropertyPulse · Reporte ${nombreMes} ${año} · ${nombreCliente}`, 50, 730, { align: 'center', width: 512 });
        doc.end();
    } catch (err) {
        console.error('[PDF]', err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Error: ' + err.message });
    }
});

module.exports = router;
