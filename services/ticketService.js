const supabase            = require('./supabaseClient');
const notificationService = require('./notificationService');
const feeService          = require('./feeService');

const ticketService = {

    // Tickets visibles para un técnico:
    // - Pendientes sin asignar (solo si el técnico está disponible, o los suyos propios)
    // - Los tickets que ya tiene asignados (en cualquier estado)
    async getTicketsParaTecnico(tecnicoId) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, propiedades(direccion), companias(nombre_empresa, nombre_contacto)')
            .or(`estado.eq.pendiente,tecnico_asignado.eq.${tecnicoId}`)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

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
            // Trabajo completado → registrar fee y liberar técnico
            feeService.registrarFee(tecnicoId, ticketId)
                .catch(err => console.error('[FEE]', err.message));

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

        // Notificar al cliente por push
        notificationService.notificarCliente(
            ticketActual.cliente_id,
            nuevoEstado,
            ticketActual
        ).catch(err => console.error('[PUSH]', err.message));

        return ticket;
    }
};

// Notificar a técnicos disponibles por email cuando hay nuevo ticket
ticketService.notificarTecnicosNuevoTicket = async function(ticket, propiedadDireccion, clienteNombre) {
    try {
        const emailService = require('./emailService');
        // Obtener técnicos activos y disponibles
        const { data: tecnicos } = await supabase
            .from('tecnicos')
            .select('nombre, email')
            .eq('activo', true)
            .eq('ocupado', false);

        if (!tecnicos?.length) return;

        // Notificar a cada técnico disponible
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
        console.log(`[EMAIL] Notificados ${tecnicos.length} técnicos de nuevo ticket`);
    } catch (err) {
        console.error('[EMAIL] Error notificando técnicos:', err.message);
    }
};

module.exports = ticketService;
