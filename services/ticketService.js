const supabase            = require('./supabaseClient');
const notificationService = require('./notificationService');

const ticketService = {

    // Tickets visibles para un técnico:
    // - Pendientes sin asignar (solo si el técnico está disponible, o los suyos propios)
    // - Los tickets que ya tiene asignados (en cualquier estado)
    async getTicketsParaTecnico(tecnicoId) {
        // Obtener la especialidad del técnico para filtrar tickets
        const { data: tec } = await supabase
            .from('tecnicos')
            .select('especialidad')
            .eq('id', tecnicoId)
            .single();

        const especialidad = tec?.especialidad;

        let query = supabase
            .from('tickets')
            .select('*, propiedades(direccion), companias(nombre_empresa, nombre_contacto)')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        // Tickets pendientes de su categoría O tickets que ya tiene asignados
        if (especialidad) {
            query = query.or(
                `and(estado.eq.pendiente,categoria.eq.${especialidad}),tecnico_asignado.eq.${tecnicoId}`
            );
        } else {
            query = query.or(`estado.eq.pendiente,tecnico_asignado.eq.${tecnicoId}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // Cambiar estado del ticket
    // en_proceso → marcar técnico como OCUPADO
    // completado/cancelado → marcar técnico como LIBRE
    async actualizarEstado(ticketId, tecnicoId, nuevoEstado) {
        const { data: ticketActual, error: fetchError } = await supabase
            .from('tickets')
            .select('*, propiedades(direccion)')
            .eq('id', ticketId)
            .single();

        if (fetchError) throw fetchError;

        const { data: ticket, error } = await supabase
            .from('tickets')
            .update({ estado: nuevoEstado, tecnico_asignado: tecnicoId })
            .eq('id', ticketId)
            .select()
            .single();

        if (error) throw error;

        // ── Actualizar estado de ocupación del técnico ────────
        if (nuevoEstado === 'en_proceso') {
            // Técnico acepta trabajo → ocupado
            await supabase
                .from('tecnicos')
                .update({ ocupado: true })
                .eq('id', tecnicoId);

        } else if (nuevoEstado === 'completado') {
            await supabase
                .from('tecnicos')
                .update({ ocupado: false })
                .eq('id', tecnicoId);

        } else if (nuevoEstado === 'cancelado') {
            // Cancelado → liberar técnico
            await supabase
                .from('tecnicos')
                .update({ ocupado: false })
                .eq('id', tecnicoId);
        }

        // Notificar al cliente con nombre del técnico
        if (nuevoEstado === 'en_proceso') {
            // Obtener nombre del técnico para el mensaje
            const { data: tecData } = await supabase
                .from('tecnicos')
                .select('nombre')
                .eq('id', tecnicoId)
                .single();

            const tecNombre = tecData?.nombre || 'El técnico';

            notificationService.notificarClienteConTecnico(
                ticketActual.cliente_id,
                nuevoEstado,
                ticketActual,
                tecNombre
            ).catch(err => console.error('[PUSH]', err.message));
        } else {
            notificationService.notificarCliente(
                ticketActual.cliente_id,
                nuevoEstado,
                ticketActual
            ).catch(err => console.error('[PUSH]', err.message));
        }

        return ticket;
    }
};

// Notificar a técnicos disponibles por email cuando hay nuevo ticket
ticketService.notificarTecnicosNuevoTicket = async function(ticket, propiedadDireccion, clienteNombre) {
    try {
        const emailService = require('./emailService');
        const { data: tecnicos } = await supabase
            .from('tecnicos')
            .select('nombre, email')
            .eq('activo', true)
            .eq('ocupado', false);

        if (!tecnicos?.length) return;

        for (const tec of tecnicos) {
            emailService.notificarTicketATecnico({
                tecnicoNombre: tec.nombre,
                tecnicoEmail:  tec.email,
                motivo:        ticket.motivo,
                categoria:     ticket.categoria,
                direccion:     propiedadDireccion,
                clienteNombre
            }).catch(() => {});
        }
        console.log(`[EMAIL] Notificados ${tecnicos.length} técnicos`);
    } catch (err) {
        console.error('[EMAIL técnicos]', err.message);
    }
};

module.exports = ticketService;
