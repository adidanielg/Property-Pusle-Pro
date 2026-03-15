// PropertyPulse — stripeService.js
// Maneja Checkout sessions, webhooks y gestión de suscripciones

const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase   = require('./supabaseClient');

const PRICES = {
    starter:  process.env.STRIPE_PRICE_STARTER,
    pro:      process.env.STRIPE_PRICE_PRO,
    business: process.env.STRIPE_PRICE_BUSINESS,
};

const stripeService = {

    // ── Crear sesión de checkout ──────────────────────────────
    async createCheckoutSession(clienteId, plan, successUrl, cancelUrl) {
        const priceId = PRICES[plan];
        if (!priceId) throw new Error(`Plan inválido: ${plan}`);

        // Obtener info del cliente
        const { data: cliente } = await supabase
            .from('companias')
            .select('email, nombre_contacto, stripe_customer_id')
            .eq('id', clienteId)
            .single();

        if (!cliente) throw new Error('Cliente no encontrado');

        // Crear o reutilizar customer en Stripe
        let customerId = cliente.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: cliente.email,
                name:  cliente.nombre_contacto,
                metadata: { cliente_id: clienteId }
            });
            customerId = customer.id;

            // Guardar customer_id en Supabase
            await supabase
                .from('companias')
                .update({ stripe_customer_id: customerId })
                .eq('id', clienteId);
        }

        // Trial de 10 días solo para Starter
        const trialDays = plan === 'starter' ? 10 : 0;

        // Crear sesión de checkout
        const sessionData = {
            customer:    customerId,
            mode:        'subscription',
            line_items:  [{ price: priceId, quantity: 1 }],
            success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  cancelUrl,
            metadata:    { cliente_id: clienteId, plan },
            subscription_data: {
                metadata: { cliente_id: clienteId, plan },
                ...(trialDays > 0 && { trial_period_days: trialDays })
            },
            allow_promotion_codes: true,
        };

        const session = await stripe.checkout.sessions.create(sessionData);

        return session;
    },

    // ── Checkout para técnicos ───────────────────────────────
    async createCheckoutSessionTecnico(tecnicoId, successUrl, cancelUrl) {
        const priceId = process.env.STRIPE_PRICE_TECNICO;
        if (!priceId) throw new Error('STRIPE_PRICE_TECNICO no configurado');

        const supabase = require('./supabaseClient');
        const { data: tecnico } = await supabase
            .from('tecnicos')
            .select('nombre, email, stripe_customer_id')
            .eq('id', tecnicoId)
            .single();

        if (!tecnico) throw new Error('Técnico no encontrado');

        let customerId = tecnico.stripe_customer_id;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: tecnico.email,
                name:  tecnico.nombre,
                metadata: { tecnico_id: tecnicoId }
            });
            customerId = customer.id;
            await supabase.from('tecnicos')
                .update({ stripe_customer_id: customerId })
                .eq('id', tecnicoId);
        }

        const session = await stripe.checkout.sessions.create({
            customer:   customerId,
            mode:       'subscription',
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  cancelUrl,
            metadata:   { tecnico_id: tecnicoId, tipo: 'tecnico' },
            subscription_data: {
                metadata: { tecnico_id: tecnicoId, tipo: 'tecnico' }
            },
        });

        return session;
    },

    // ── Cancelar suscripción ──────────────────────────────────
    async cancelSubscription(clienteId) {
        const { data: cliente } = await supabase
            .from('companias')
            .select('stripe_subscription_id')
            .eq('id', clienteId)
            .single();

        if (!cliente?.stripe_subscription_id) {
            throw new Error('No tienes una suscripción activa');
        }

        // Cancelar al final del período (no inmediatamente)
        await stripe.subscriptions.update(cliente.stripe_subscription_id, {
            cancel_at_period_end: true
        });

        return { success: true };
    },

    // ── Crear portal de cliente (gestionar suscripción) ───────
    async createPortalSession(clienteId, returnUrl) {
        const { data: cliente } = await supabase
            .from('companias')
            .select('stripe_customer_id')
            .eq('id', clienteId)
            .single();

        if (!cliente?.stripe_customer_id) {
            throw new Error('No tienes una suscripción activa');
        }

        const session = await stripe.billingPortal.sessions.create({
            customer:   cliente.stripe_customer_id,
            return_url: returnUrl,
        });

        return session;
    },

    // ── Verificar webhook ─────────────────────────────────────
    verifyWebhook(payload, signature) {
        return stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    },

    // ── Procesar evento de webhook ────────────────────────────
    async handleWebhookEvent(event) {
        switch (event.type) {

            case 'checkout.session.completed': {
                const session   = event.data.object;
                const tipo      = session.metadata?.tipo;

                // ── Checkout de TÉCNICO ───────────────────────
                if (tipo === 'tecnico') {
                    const tecnicoId = session.metadata?.tecnico_id;
                    if (!tecnicoId) break;
                    await supabase.from('tecnicos').update({
                        suscripcion_activa:     true,
                        stripe_subscription_id: session.subscription,
                    }).eq('id', tecnicoId);
                    console.log(`[STRIPE] ✅ Técnico suscrito: ${tecnicoId}`);
                    break;
                }

                // ── Checkout de CLIENTE ───────────────────────
                let clienteId   = session.metadata?.cliente_id;
                let plan        = session.metadata?.plan;
                const subId     = session.subscription;

                // Fallback: buscar por stripe_customer_id si no hay metadata
                if (!clienteId && session.customer) {
                    const { data: c } = await supabase
                        .from('companias')
                        .select('id, plan')
                        .eq('stripe_customer_id', session.customer)
                        .single();
                    if (c) clienteId = c.id;
                }

                if (!clienteId) {
                    console.error('[STRIPE] checkout.session.completed sin cliente_id', session.id);
                    break;
                }

                // Si no hay plan en metadata, deducirlo del price_id
                if (!plan && session.line_items) {
                    const priceId = session.line_items?.data?.[0]?.price?.id;
                    plan = Object.entries(PRICES).find(([, v]) => v === priceId)?.[0] || 'starter';
                }
                plan = plan || 'starter';

                await supabase
                    .from('companias')
                    .update({
                        plan,
                        stripe_subscription_id: subId,
                        suscripcion_activa:     true,
                    })
                    .eq('id', clienteId);

                console.log(`[STRIPE] ✅ Checkout completado: cliente=${clienteId} plan=${plan}`);

                // Enviar email de confirmación de plan
                try {
                    const emailService = require('./emailService');
                    const { data: cliente } = await supabase
                        .from('companias')
                        .select('email, nombre_contacto')
                        .eq('id', clienteId)
                        .single();
                    if (cliente) {
                        emailService.enviarConfirmacionPlan({
                            nombre: cliente.nombre_contacto,
                            email:  cliente.email,
                            plan,
                            proximaFactura: plan === 'starter' ? 'en 10 días (después del trial)' : null
                        });
                    }
                } catch (emailErr) {
                    console.error('[EMAIL] Error confirmación plan:', emailErr.message);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const sub       = event.data.object;
                const clienteId = sub.metadata?.cliente_id;

                if (!clienteId) break;

                // Obtener el plan del price_id actual
                const priceId = sub.items.data[0]?.price?.id;
                const plan    = Object.entries(PRICES).find(([, v]) => v === priceId)?.[0];

                const activa = ['active', 'trialing'].includes(sub.status);

                await supabase
                    .from('companias')
                    .update({
                        plan:                   plan || 'starter',
                        suscripcion_activa:     activa,
                        stripe_subscription_id: sub.id,
                    })
                    .eq('id', clienteId);

                console.log(`[STRIPE] Suscripción actualizada: cliente=${clienteId} plan=${plan} activa=${activa}`);
                break;
            }

            case 'customer.subscription.deleted': {
                const sub       = event.data.object;
                const tipo      = sub.metadata?.tipo;
                const tecnicoId = sub.metadata?.tecnico_id;
                const clienteId = sub.metadata?.cliente_id;

                // Técnico canceló
                if (tipo === 'tecnico' && tecnicoId) {
                    await supabase.from('tecnicos').update({
                        suscripcion_activa:     false,
                        stripe_subscription_id: null,
                    }).eq('id', tecnicoId);
                    console.log(`[STRIPE] Técnico canceló suscripción: ${tecnicoId}`);
                    break;
                }

                if (!clienteId) break;

                await supabase
                    .from('companias')
                    .update({
                        plan:                   'starter',
                        suscripcion_activa:     false,
                        stripe_subscription_id: null,
                    })
                    .eq('id', clienteId);

                console.log(`[STRIPE] Suscripción cancelada: cliente=${clienteId}`);
                break;
            }

            default:
                console.log(`[STRIPE] Evento no manejado: ${event.type}`);
        }
    }
};

module.exports = stripeService;
