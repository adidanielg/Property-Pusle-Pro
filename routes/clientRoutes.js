const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const { requireAuth }     = require('../middleware/authMiddleware');
const supabase            = require('../services/supabaseClient');
const notificationService = require('../services/notificationService');

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
                .order('created_at', { ascending: false }),
            supabase.from('tickets')
                .select('*, propiedades(direccion), tecnicos:tecnico_asignado(nombre)')
                .eq('cliente_id', id)
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
router.post('/tickets', upload.single('foto'), async (req, res) => {
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

        res.status(201).json({ success: true, ticket });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Calificar técnico ─────────────────────────────────────────
router.post('/calificar', async (req, res) => {
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
router.post('/propiedades', async (req, res) => {
    try {
        const { direccion, servicios_contratados } = req.body;

        // ── Verificar límite de propiedades del plan ──────────
        const limitCheck = await checkPropiedadLimit(req.user.id);
        if (!limitCheck.allowed) {
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
            .select().single();
        if (error) throw error;
        res.json({ success: true, propiedad: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/propiedades/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('propiedades')
            .delete()
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
router.put('/perfil', async (req, res) => {
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
router.post('/tickets/:id/cancelar', async (req, res) => {
    try {
        const { motivo } = req.body;
        const { data: ticket } = await supabase
            .from('tickets').select('id, titulo, categoria, tecnico_id, compania_id')
            .eq('id', req.params.id).eq('compania_id', req.user.id).single();

        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

        // Actualizar estado
        await supabase.from('tickets').update({ estado: 'cancelado' }).eq('id', ticket.id);

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
            titulo:         ticket.titulo
        });

        // Notificar al técnico si estaba asignado
        if (ticket.tecnico_id) {
            const { data: tecSub } = await supabase
                .from('push_subscriptions').select('subscription').eq('user_id', ticket.tecnico_id).single();
            if (tecSub) {
                const webpush = require('web-push');
                webpush.setVapidDetails(
                    'mailto:admin@propertypulse.com',
                    process.env.VAPID_PUBLIC_KEY,
                    process.env.VAPID_PRIVATE_KEY
                );
                webpush.sendNotification(tecSub.subscription, JSON.stringify({
                    title: '❌ Ticket cancelado',
                    body:  `El cliente canceló: ${ticket.titulo}`,
                    url:   '/tecnico/dashboard'
                })).catch(() => {});
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
router.post('/tickets/:id/mensajes', async (req, res) => {
    try {
        const { mensaje } = req.body;
        if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

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
        // Eliminar push subscriptions
        await supabase.from('push_subscriptions').delete().eq('compania_id', id);
        // Eliminar la compañía (cuenta)
        await supabase.from('companias').delete().eq('id', id);
        // Limpiar cookie
        res.clearCookie('jwt');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;