// PropertyPulse — feeService.js
// Maneja fees de $4.50 por trabajo completado
// El primer trabajo de cada técnico es gratuito

const supabase = require('./supabaseClient');

const FEE_MONTO = 4.50;

const feeService = {

    // Registrar fee al completar un ticket
    async registrarFee(tecnicoId, ticketId) {
        try {
            // Contar trabajos completados anteriores (excluyendo este)
            const { count } = await supabase
                .from('fees_tecnicos')
                .select('*', { count: 'exact', head: true })
                .eq('tecnico_id', tecnicoId);

            const esGratis = count === 0; // primer trabajo gratis

            const { data, error } = await supabase
                .from('fees_tecnicos')
                .insert({
                    tecnico_id: tecnicoId,
                    ticket_id:  ticketId,
                    monto:      esGratis ? 0 : FEE_MONTO,
                    es_gratis:  esGratis
                })
                .select()
                .single();

            if (error && error.code !== '23505') throw error; // ignorar duplicate
            return { success: true, esGratis, monto: esGratis ? 0 : FEE_MONTO };
        } catch (err) {
            console.error('[FEE SERVICE]', err.message);
            return { success: false, error: err.message };
        }
    },

    // Obtener resumen de fees de un técnico
    async getResumenTecnico(tecnicoId) {
        const { data: fees } = await supabase
            .from('fees_tecnicos')
            .select('monto, es_gratis, cobrado, created_at')
            .eq('tecnico_id', tecnicoId)
            .order('created_at', { ascending: false });

        const totalTrabajos  = fees?.length || 0;
        const feePendiente   = fees?.filter(f => !f.cobrado && !f.es_gratis)
                                   .reduce((acc, f) => acc + parseFloat(f.monto), 0) || 0;
        const feeCobrado     = fees?.filter(f => f.cobrado)
                                   .reduce((acc, f) => acc + parseFloat(f.monto), 0) || 0;
        const primerTrabajo  = totalTrabajos === 0; // próximo será gratis

        return {
            totalTrabajos,
            feePendiente:  parseFloat(feePendiente.toFixed(2)),
            feeCobrado:    parseFloat(feeCobrado.toFixed(2)),
            primerTrabajo,
            fees: fees || []
        };
    },

    // Marcar fees como cobrados (admin)
    async marcarCobrado(tecnicoId) {
        const { error } = await supabase
            .from('fees_tecnicos')
            .update({ cobrado: true, cobrado_at: new Date().toISOString() })
            .eq('tecnico_id', tecnicoId)
            .eq('cobrado', false)
            .eq('es_gratis', false);

        if (error) throw error;
        return { success: true };
    },

    // Obtener técnico con mejor rating disponible para un ticket
    async getTecnicoPorRating() {
        const { data: tecnicos } = await supabase
            .from('tecnicos')
            .select(`
                id, nombre, especialidad,
                calificaciones(estrellas)
            `)
            .eq('activo', true)
            .eq('ocupado', false); // Solo técnicos disponibles

        if (!tecnicos?.length) return null;

        // Calcular promedio de cada técnico
        const conRating = tecnicos.map(t => {
            const califs = t.calificaciones || [];
            const promedio = califs.length > 0
                ? califs.reduce((acc, c) => acc + c.estrellas, 0) / califs.length
                : 3; // rating neutral para nuevos
            return { ...t, promedio, totalCalif: califs.length };
        });

        // Ordenar por promedio desc, luego por total de calificaciones desc
        conRating.sort((a, b) =>
            b.promedio !== a.promedio
                ? b.promedio - a.promedio
                : b.totalCalif - a.totalCalif
        );

        return conRating;
    }
};

module.exports = feeService;