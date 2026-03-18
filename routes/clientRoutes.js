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
        const [{ data: propiedades }, { data: tickets }, { data: misCalificaciones }] = await Promise.all([
            supabase.from('propiedades')
                .select('*')
                .eq('compania_id', id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false }),
            supabase.from('tickets')
                .select('*, propiedades(direccion), tecnicos:tecnico_asignado(nombre)')
                .eq('cliente_id', id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false }),
            supabase.from('calificaciones')
                .select('ticket_id')
                .eq('cliente_id', id)
        ]);

        // IDs de tickets ya calificados
        const ticketsCalificados = new Set((misCalificaciones || []).map(c => c.ticket_id));

        res.render('dashboardCliente.html', {
            title:              'Mi Panel | PropertyPulse',
            cliente:            req.user,
            propiedades:        propiedades        || [],
            tickets:            tickets            || [],
            ticketsCalificados
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


// ── Reporte PDF mensual ───────────────────────────────────────
router.get('/reporte-pdf', async (req, res) => {
    try {
        const id  = req.user.id;
        const mes = req.query.mes || new Date().getMonth() + 1;
        const año = req.query.año || new Date().getFullYear();

        // Rango del mes
        const inicio = new Date(año, mes - 1, 1).toISOString();
        const fin    = new Date(año, mes, 0, 23, 59, 59).toISOString();

        const { data: clienteInfo } = await supabase
            .from('companias')
            .select('nombre_contacto, nombre_empresa, email, tipo_cliente')
            .eq('id', id).single();

        const { data: tickets } = await supabase
            .from('tickets')
            .select('*, propiedades(direccion), tecnicos:tecnico_asignado(nombre)')
            .eq('cliente_id', id)
            .gte('created_at', inicio)
            .lte('created_at', fin)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        const nombreCliente = clienteInfo?.tipo_cliente === 'Compania'
            ? clienteInfo.nombre_empresa
            : clienteInfo?.nombre_contacto || 'Cliente';

        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                       'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const nombreMes = meses[mes - 1];

        const completados = (tickets || []).filter(t => t.estado === 'completado').length;
        const pendientes  = (tickets || []).filter(t => t.estado === 'pendiente').length;
        const enProceso   = (tickets || []).filter(t => t.estado === 'en_proceso').length;

        const estadoColor = {
            pendiente:  '#f59e0b',
            en_proceso: '#3b82f6',
            completado: '#10b981',
            cancelado:  '#6b7280'
        };

        const estadoLabel = {
            pendiente:  'Pendiente',
            en_proceso: 'En proceso',
            completado: 'Completado',
            cancelado:  'Cancelado'
        };

        const ticketRows = (tickets || []).map(t => `
        <tr>
            <td>${t.motivo}</td>
            <td>${t.categoria || '—'}</td>
            <td>${t.propiedades?.direccion || '—'}</td>
            <td>${t.tecnicos?.nombre || '—'}</td>
            <td><span style="color:${estadoColor[t.estado]};font-weight:600">${estadoLabel[t.estado] || t.estado}</span></td>
            <td>${new Date(t.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}</td>
        </tr>`).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #7c6dfa; }
  .logo { font-size: 22px; font-weight: 800; color: #1a1a2e; }
  .logo span { color: #7c6dfa; }
  .header-right { text-align: right; color: #666; font-size: 12px; line-height: 1.6; }
  .title { font-size: 18px; font-weight: 700; margin-bottom: 4px; color: #1a1a2e; }
  .subtitle { font-size: 12px; color: #888; margin-bottom: 28px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat { background: #f8f7ff; border: 1px solid #e8e6ff; border-radius: 10px; padding: 14px 16px; }
  .stat-num { font-size: 28px; font-weight: 800; letter-spacing: -1px; color: #7c6dfa; }
  .stat-label { font-size: 11px; color: #888; margin-top: 2px; text-transform: uppercase; letter-spacing: .04em; }
  .section-title { font-size: 13px; font-weight: 700; color: #1a1a2e; margin-bottom: 10px; text-transform: uppercase; letter-spacing: .05em; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #7c6dfa; color: #fff; padding: 9px 12px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  th:first-child { border-radius: 6px 0 0 6px; }
  th:last-child  { border-radius: 0 6px 6px 0; }
  td { padding: 9px 12px; border-bottom: 1px solid #f0f0f8; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #fafaf8; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #aaa; }
  .empty { text-align: center; padding: 32px; color: #aaa; font-style: italic; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Property<span>Pulse</span></div>
      <div style="font-size:11px;color:#888;margin-top:4px">getpropertypulse.net</div>
    </div>
    <div class="header-right">
      <div style="font-weight:700;color:#1a1a2e">${nombreCliente}</div>
      <div>${clienteInfo?.email || ''}</div>
      <div>Reporte generado: ${new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
  </div>

  <div class="title">Reporte Mensual — ${nombreMes} ${año}</div>
  <div class="subtitle">Resumen de tickets de mantenimiento del período</div>

  <div class="stats">
    <div class="stat">
      <div class="stat-num">${(tickets || []).length}</div>
      <div class="stat-label">Total tickets</div>
    </div>
    <div class="stat">
      <div class="stat-num" style="color:#10b981">${completados}</div>
      <div class="stat-label">Completados</div>
    </div>
    <div class="stat">
      <div class="stat-num" style="color:#3b82f6">${enProceso}</div>
      <div class="stat-label">En proceso</div>
    </div>
    <div class="stat">
      <div class="stat-num" style="color:#f59e0b">${pendientes}</div>
      <div class="stat-label">Pendientes</div>
    </div>
  </div>

  <div class="section-title">Detalle de tickets</div>
  ${(tickets || []).length === 0 ? '<div class="empty">No hay tickets para este período.</div>' : `
  <table>
    <thead>
      <tr>
        <th>Motivo</th>
        <th>Categoría</th>
        <th>Dirección</th>
        <th>Técnico</th>
        <th>Estado</th>
        <th>Fecha</th>
      </tr>
    </thead>
    <tbody>${ticketRows}</tbody>
  </table>`}

  <div class="footer">
    PropertyPulse · Reporte ${nombreMes} ${año} · ${nombreCliente} · Generado automáticamente
  </div>
</body>
</html>`;

        // Generar PDF con html-pdf-node
        const htmlPdf = require('html-pdf-node');
        const options = { format: 'Letter', margin: { top: '0', bottom: '0', left: '0', right: '0' } };
        const file    = { content: html };

        const pdfBuffer = await htmlPdf.generatePdf(file, options);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="reporte-${nombreMes}-${año}.pdf"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error('[PDF]', err.message);
        res.status(500).json({ error: 'Error generando el reporte' });
    }
});

module.exports = router;
