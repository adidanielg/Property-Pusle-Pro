const express     = require('express');
const router      = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const ticketService   = require('../services/ticketService');

router.use(requireAuth(['tecnico']));

// ── Dashboard ────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const tickets = await ticketService.getTicketsParaTecnico(req.user.id);
        res.render('pages/dashboardTecnico.html', {
            title:   'Panel Técnico | PropertyPulse',
            tecnico: req.user,
            tickets: tickets || []
        });
    } catch (err) {
        console.error('[TECH DASHBOARD]', err);
        res.status(500).send('Error cargando el panel');
    }
});

// ── Cambiar estado de ticket ─────────────────────────────────
router.post('/tickets/:id/estado', async (req, res) => {
    try {
        const { estado } = req.body;
        const validos = ['en_proceso', 'completado'];

        if (!validos.includes(estado))
            return res.status(400).json({ error: 'Estado no válido' });

        const ticket = await ticketService.actualizarEstado(req.params.id, req.user.id, estado);
        res.json({ success: true, ticket });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;