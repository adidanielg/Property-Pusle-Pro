const supabase            = require('./supabaseClient');
const notificationService = require('./notificationService');

const ticketService = {

    // Tickets visibles para un técnico: pendientes + los suyos en proceso/completado
    async getTicketsParaTecnico(tecnicoId) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, propiedades(direccion), companias(nombre_empresa, nombre_contacto)')
            .or(`estado.eq.pendiente,tecnico_asignado.eq.${tecnicoId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Cambiar estado del ticket + notificar al cliente
    async actualizarEstado(ticketId, tecnicoId, nuevoEstado) {
        // Obtener ticket actual con datos del cliente
        const { data: ticketActual, error: fetchError } = await supabase
            .from('tickets')
            .select('*, propiedades(direccion)')
            .eq('id', ticketId)
            .single();

        if (fetchError) throw fetchError;

        // Actualizar en base de datos
        const { data: ticket, error } = await supabase
            .from('tickets')
            .update({ estado: nuevoEstado, tecnico_asignado: tecnicoId })
            .eq('id', ticketId)
            .select()
            .single();

        if (error) throw error;

        // Notificar al cliente sin bloquear la respuesta HTTP
        notificationService.notificarCliente(
            ticketActual.cliente_id,
            nuevoEstado,
            ticketActual
        ).catch(err => console.error('[PUSH]', err.message));

        return ticket;
    }
};

module.exports = ticketService;