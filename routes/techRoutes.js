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

        res.render('pages/dashboardTecnico.html', {
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

module.exports = router;