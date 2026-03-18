const webpush = require('web-push');
const supabase = require('./supabaseClient');

webpush.setVapidDetails(
    'mailto:admin@propertypulse.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

const notificationService = {

    // ── Guardar suscripción push de un usuario ────────────────
    async guardarSuscripcion(userId, userRole, subscription) {
        const table = userRole === 'tecnico' ? 'tecnicos' : 'companias';
        const { error } = await supabase
            .from(table)
            .update({ push_subscription: JSON.stringify(subscription) })
            .eq('id', userId);
        if (error) throw error;
    },

    // ── Notificar a TODOS los técnicos cuando llega ticket nuevo
    async notificarTecnicos(ticket) {
        try {
            const { data: tecnicos, error } = await supabase
                .from('tecnicos')
                .select('id, nombre, push_subscription')
                .not('push_subscription', 'is', null);

            if (error || !tecnicos?.length) return;

            const payload = JSON.stringify({
                title: '🔔 Nuevo ticket disponible',
                body:  `${ticket.motivo} — ${ticket.propiedades?.direccion || 'Ver detalles'}`,
                url:   '/tecnico/dashboard'
            });

            await Promise.allSettled(
                tecnicos.map(async tecnico => {
                    try {
                        await webpush.sendNotification(
                            JSON.parse(tecnico.push_subscription),
                            payload
                        );
                    } catch (err) {
                        // Suscripción expirada — limpiar
                        if (err.statusCode === 410) {
                            await supabase.from('tecnicos')
                                .update({ push_subscription: null })
                                .eq('id', tecnico.id);
                        }
                    }
                })
            );
        } catch (err) {
            console.error('[PUSH técnicos]', err.message);
        }
    },

    // ── Notificar al cliente cuando el técnico cambia el estado
    async notificarCliente(clienteId, nuevoEstado, ticket) {
        try {
            const { data: cliente, error } = await supabase
                .from('companias')
                .select('push_subscription')
                .eq('id', clienteId)
                .single();

            if (error || !cliente?.push_subscription) return;

            const mensajes = {
                en_proceso: { emoji: '🔄', texto: 'Un técnico aceptó tu solicitud y está en camino.' },
                completado: { emoji: '✅', texto: 'Tu solicitud de mantenimiento fue completada.' }
            };

            const msg = mensajes[nuevoEstado];
            if (!msg) return;

            await webpush.sendNotification(
                JSON.parse(cliente.push_subscription),
                JSON.stringify({
                    title: `${msg.emoji} Ticket actualizado`,
                    body:  `${ticket.motivo} — ${msg.texto}`,
                    url:   '/cliente/dashboard'
                })
            );

        } catch (err) {
            if (err.statusCode === 410) {
                await supabase.from('companias')
                    .update({ push_subscription: null })
                    .eq('id', clienteId);
            }
            console.error('[PUSH cliente]', err.message);
        }
    },

    // ── Notificar al cliente con nombre del técnico ─────────
    async notificarClienteConTecnico(clienteId, nuevoEstado, ticket, tecNombre) {
        try {
            const { data: cliente } = await supabase
                .from('companias')
                .select('push_subscription')
                .eq('id', clienteId)
                .single();

            if (!cliente?.push_subscription) return;

            const mensajes = {
                en_proceso: {
                    title: '🔄 Técnico en camino',
                    body:  `${tecNombre} aceptó tu trabajo y está en camino. (${ticket.motivo})`
                },
                cotizacion: {
                    title: '💰 Nueva cotización recibida',
                    body:  `${tecNombre} envió una cotización para: ${ticket.motivo}`
                }
            };
            const msg = mensajes[nuevoEstado] || mensajes['en_proceso'];
            await webpush.sendNotification(
                JSON.parse(cliente.push_subscription),
                JSON.stringify({
                    title: msg.title,
                    body:  msg.body,
                    url:   '/cliente/dashboard'
                })
            );
        } catch (err) {
            if (err.statusCode === 410) {
                await supabase.from('companias')
                    .update({ push_subscription: null })
                    .eq('id', clienteId);
            }
            console.error('[PUSH cliente técnico]', err.message);
        }
    }
};

module.exports = notificationService;