const express    = require('express');
const router     = express.Router();
const { requireAuth }     = require('../middleware/authMiddleware');
const notificationService = require('../services/notificationService');

// POST /notificaciones/suscribir
// El frontend llama esto cuando el usuario acepta las notificaciones push
router.post('/suscribir', requireAuth(['cliente', 'tecnico', 'admin']), async (req, res) => {
    try {
        const subscription = req.body;

        if (!subscription?.endpoint)
            return res.status(400).json({ error: 'Suscripción inválida' });

        await notificationService.guardarSuscripcion(
            req.user.id,
            req.user.role,
            subscription
        );

        res.json({ success: true });

    } catch (err) {
        console.error('[SUSCRIPCION PUSH]', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;