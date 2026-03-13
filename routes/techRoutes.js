const express     = require('express');
const router      = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const ticketService   = require('../services/ticketService');
const supabase        = require('../services/supabaseClient');

router.use(requireAuth(['tecnico']));

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const [tickets, { data: calificaciones }] = await Promise.all([
            ticketService.getTicketsParaTecnico(req.user.id),
            supabase.from('calificaciones')
                .select('estrellas, comentario, created_at, companias:cliente_id(nombre_contacto, nombre_empresa)')
                .eq('tecnico_id', req.user.id)
                .order('created_at', { ascending: false })
        ]);

        const totalCalif = calificaciones?.length || 0;
        const promedio   = totalCalif > 0
            ? (calificaciones.reduce((acc, c) => acc + c.estrellas, 0) / totalCalif).toFixed(1)
            : null;

        res.render('dashboardTecnico.html', {
            title:          'Panel Técnico | PropertyPulse',
            tecnico:        req.user,
            tickets:        tickets        || [],
            calificaciones: calificaciones || [],
            promedio,
            totalCalif
        });
    } catch (err) {
        console.error('[TECH DASHBOARD]', err);
        res.status(500).send('Error cargando el panel');
    }
});

// ── Cambiar estado ────────────────────────────────────────────
router.post('/tickets/:id/estado', async (req, res) => {
    try {
        const { estado } = req.body;
        const validos = ['en_proceso', 'completado'];

        if (!validos.includes(estado))
            return res.status(400).json({ error: 'Estado no válido' });

        // ── SEGURIDAD: verificar que el ticket le pertenece ───
        const { data: ticket, error: fetchErr } = await supabase
            .from('tickets')
            .select('id, tecnico_asignado, estado')
            .eq('id', req.params.id)
            .single();

        if (fetchErr || !ticket)
            return res.status(404).json({ error: 'Ticket no encontrado' });

        // Pendiente: cualquier técnico puede aceptarlo (aún no tiene dueño)
        // En proceso / completado: solo el técnico asignado puede avanzarlo
        if (ticket.estado !== 'pendiente' && ticket.tecnico_asignado !== req.user.id)
            return res.status(403).json({ error: 'No tienes permiso para modificar este ticket' });

        // Si ya está completado no se puede cambiar
        if (ticket.estado === 'completado')
            return res.status(400).json({ error: 'Este ticket ya está completado' });

        const ticketActualizado = await ticketService.actualizarEstado(
            req.params.id,
            req.user.id,
            estado
        );
        res.json({ success: true, ticket: ticketActualizado });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Perfil: obtener datos actuales ───────────────────────────
router.get('/perfil', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tecnicos')
            .select('id, nombre, email, telefono, especialidad')
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
        const { nombre, email, telefono, especialidad, password, nueva_password } = req.body;

        if (nueva_password) {
            const { data: user } = await supabase
                .from('tecnicos').select('password').eq('id', req.user.id).single();
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
        }

        const updates = { nombre, email, telefono, especialidad };
        if (nueva_password) {
            updates.password = await bcrypt.hash(nueva_password, 10);
        }

        const { data, error } = await supabase
            .from('tecnicos')
            .update(updates)
            .eq('id', req.user.id)
            .select('id, nombre, email, telefono, especialidad')
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


// ── Cancelar ticket (técnico) ─────────────────────────────────
router.post('/tickets/:id/cancelar', async (req, res) => {
    try {
        const { motivo } = req.body;
        const { data: ticket } = await supabase
            .from('tickets').select('id, titulo, categoria, compania_id, tecnico_id')
            .eq('id', req.params.id).eq('tecnico_id', req.user.id).single();

        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

        await supabase.from('tickets')
            .update({ estado: 'cancelado', tecnico_id: null })
            .eq('id', ticket.id);

        // Log
        const { data: tec } = await supabase
            .from('tecnicos').select('nombre, especialidad').eq('id', req.user.id).single();

        await supabase.from('cancelaciones').insert({
            ticket_id:      ticket.id,
            cancelado_por:  'tecnico',
            usuario_id:     req.user.id,
            usuario_nombre: tec?.nombre || 'Técnico',
            motivo:         motivo || 'Sin motivo',
            categoria:      ticket.categoria,
            titulo:         ticket.titulo
        });

        // Notificar al cliente
        const { data: cliSub } = await supabase
            .from('push_subscriptions').select('subscription').eq('user_id', ticket.compania_id).single();
        if (cliSub) {
            const webpush = require('web-push');
            webpush.setVapidDetails(
                'mailto:admin@propertypulse.com',
                process.env.VAPID_PUBLIC_KEY,
                process.env.VAPID_PRIVATE_KEY
            );
            webpush.sendNotification(cliSub.subscription, JSON.stringify({
                title: '❌ Técnico canceló el trabajo',
                body:  `${tec?.nombre || 'El técnico'} canceló: ${ticket.titulo}`,
                url:   '/cliente/dashboard'
            })).catch(() => {});
        }

        // Volver a poner el ticket como pendiente sin técnico
        await supabase.from('tickets')
            .update({ estado: 'pendiente' })
            .eq('id', ticket.id);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Chat: obtener mensajes ─────────────────────────────────────
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

// ── Chat: enviar mensaje ───────────────────────────────────────
router.post('/tickets/:id/mensajes', async (req, res) => {
    try {
        const { mensaje } = req.body;
        if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje vacío' });

        const { data: tec } = await supabase
            .from('tecnicos').select('nombre').eq('id', req.user.id).single();

        const { data } = await supabase.from('ticket_mensajes').insert({
            ticket_id:    req.params.id,
            autor_id:     req.user.id,
            autor_nombre: tec?.nombre || 'Técnico',
            autor_rol:    'tecnico',
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
        await supabase.from('push_subscriptions').delete().eq('tecnico_id', id);
        await supabase.from('tecnicos').delete().eq('id', id);
        res.clearCookie('jwt');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;