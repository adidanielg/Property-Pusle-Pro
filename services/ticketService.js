const supabase = require('./supabaseClient');

const ticketService = {

    // Tickets visibles para un técnico: pendientes + los suyos
    async getTicketsParaTecnico(tecnicoId) {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, propiedades(direccion), companias(nombre_empresa, nombre_contacto)')
            .or(`estado.eq.pendiente,tecnico_asignado.eq.${tecnicoId}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Cambiar estado y asignar técnico
    async actualizarEstado(ticketId, tecnicoId, nuevoEstado) {
        const { data, error } = await supabase
            .from('tickets')
            .update({ estado: nuevoEstado, tecnico_asignado: tecnicoId })
            .eq('id', ticketId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};

module.exports = ticketService;