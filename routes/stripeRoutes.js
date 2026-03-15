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

// Webhook manejado en server.js directamente

// ── POST /stripe/activate-by-session ─────────────────────────
// Fallback público: activar plan si el webhook tardó o falló
// No requiere auth — usa session_id para verificar y cliente_id del metadata
router.post('/activate-by-session', async (req, res) => {
    try {
        const { session_id } = req.body;
        if (!session_id) return res.json({ success: false });

        const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(session_id);

        // Verificar que el checkout fue completado
        const isValid = session.status === 'complete' ||
                        session.payment_status === 'paid' ||
                        session.payment_status === 'no_payment_required';
        if (!isValid) {
            return res.json({ success: false, reason: 'not_completed' });
        }

        // Obtener cliente_id del metadata
        const clienteId = session.metadata?.cliente_id;
        if (!clienteId) return res.json({ success: false, reason: 'no_cliente_id' });

        const plan  = session.metadata?.plan || 'starter';
        const subId = session.subscription;
        const supabase = require('../services/supabaseClient');

        await supabase
            .from('companias')
            .update({
                plan,
                stripe_subscription_id: subId,
                suscripcion_activa:     true,
            })
            .eq('id', clienteId);

        console.log(`[STRIPE FALLBACK] ✅ Plan activado: cliente=${clienteId} plan=${plan}`);
        res.json({ success: true, plan });
    } catch (err) {
        console.error('[STRIPE FALLBACK]', err.message);
        res.json({ success: false });
    }
});

module.exports = router;
