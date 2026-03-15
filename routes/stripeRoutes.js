// PropertyPulse — stripeRoutes.js
// Rutas para checkout, portal de cliente y webhook

const express       = require('express');
const router        = express.Router();
const stripeService = require('../services/stripeService');
const { requireAuth } = require('../middleware/authMiddleware');

// ── POST /stripe/checkout ─────────────────────────────────────
// Crear sesión de pago y redirigir a Stripe
router.post('/checkout', requireAuth(['cliente']), async (req, res) => {
    try {
        const { plan } = req.body;

        if (!['starter', 'pro', 'business'].includes(plan)) {
            return res.status(400).json({ error: 'Plan inválido' });
        }

        const baseUrl   = process.env.BASE_URL || 'https://www.getpropertypulse.net';
        const successUrl = `${baseUrl}/cliente/dashboard?upgraded=1`;
        const cancelUrl  = `${baseUrl}/pricing`;

        const session = await stripeService.createCheckoutSession(
            req.user.id,
            plan,
            successUrl,
            cancelUrl
        );

        res.json({ success: true, url: session.url });
    } catch (err) {
        console.error('[STRIPE CHECKOUT]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /stripe/portal ───────────────────────────────────────
// Portal de Stripe para gestionar/cancelar suscripción
router.post('/portal', requireAuth(['cliente']), async (req, res) => {
    try {
        const baseUrl   = process.env.BASE_URL || 'https://www.getpropertypulse.net';
        const returnUrl = `${baseUrl}/cliente/dashboard`;

        const session = await stripeService.createPortalSession(
            req.user.id,
            returnUrl
        );

        res.json({ success: true, url: session.url });
    } catch (err) {
        console.error('[STRIPE PORTAL]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /stripe/cancel ───────────────────────────────────────
// Cancelar suscripción al final del período
router.post('/cancel', requireAuth(['cliente']), async (req, res) => {
    try {
        await stripeService.cancelSubscription(req.user.id);
        res.json({ success: true, message: 'Suscripción cancelada al final del período' });
    } catch (err) {
        console.error('[STRIPE CANCEL]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /webhook/stripe ──────────────────────────────────────
// Webhook de Stripe — DEBE recibir el body RAW (sin parsear)
// Esta ruta se registra en server.js ANTES del express.json()
router.post('/webhook/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        const signature = req.headers['stripe-signature'];

        try {
            const event = stripeService.verifyWebhook(req.body, signature);
            await stripeService.handleWebhookEvent(event);
            res.json({ received: true });
        } catch (err) {
            console.error('[STRIPE WEBHOOK]', err.message);
            res.status(400).json({ error: `Webhook error: ${err.message}` });
        }
    }
);

module.exports = router;
