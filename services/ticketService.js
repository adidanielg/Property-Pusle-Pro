const supabase            = require('./supabaseClient');
const notificationService = require('./notificationService');
const feeService          = require('./feeService');

const ticketService = {

    // Tickets visibles para un técnico: pendientes (ordenados por rating) + los suyos
    async getTicketsParaTecnico(tecnicoId) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, propiedades(direccion), companias(nombre_empresa, nombre_contacto)')
            .or(`estado.eq.pendiente,tecnico_asignado.eq.${tecnicoId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Cambiar estado del ticket + notificar al cliente + registrar fee si completado
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

        // Si se completó → registrar fee automáticamente
        if (nuevoEstado === 'completado') {
            feeService.registrarFee(tecnicoId, ticketId)
                .catch(err => console.error('[FEE]', err.message));
        }

        // Notificar al cliente
        notificationService.notificarCliente(
            ticketActual.cliente_id,
            nuevoEstado,
            ticketActual
        ).catch(err => console.error('[PUSH]', err.message));

        return ticket;
    }
};

module.exports = ticketService;