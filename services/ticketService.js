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

        // Consulta 1: tickets pendientes de su categoría
        let pendientesQuery = supabase
            .from('tickets')
            .select('*, propiedades(direccion), companias(nombre_empresa, nombre_contacto)')
            .eq('estado', 'pendiente')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (especialidad) {
            pendientesQuery = pendientesQuery.eq('categoria', especialidad);
        }

        // Consulta 2: tickets ya asignados a este técnico (cualquier estado)
        const asignadosQuery = supabase
            .from('tickets')
            .select('*, propiedades(direccion), companias(nombre_empresa, nombre_contacto)')
            .eq('tecnico_asignado', tecnicoId)
            .neq('estado', 'pendiente')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        const [{ data: pendientes, error: e1 }, { data: asignados, error: e2 }] = await Promise.all([
            pendientesQuery,
            asignadosQuery
        ]);

        if (e1) throw e1;
        if (e2) throw e2;

        // Combinar y eliminar duplicados por id
        const todos = [...(pendientes || []), ...(asignados || [])];
        const unicos = Array.from(new Map(todos.map(t => [t.id, t])).values());
        unicos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return unicos;
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

/**
 * IDOR guard: technician may only access chat if they are assigned to the ticket,
 * or the ticket is still unassigned/pending in their specialty pool (same as dashboard list).
 */
ticketService.tecnicoPuedeAccederTicket = async function (tecnicoId, ticketId) {
    const { data: ticket, error: tErr } = await supabase
        .from('tickets')
        .select('id, estado, tecnico_asignado, categoria, deleted_at')
        .eq('id', ticketId)
        .maybeSingle();

    if (tErr || !ticket || ticket.deleted_at) {
        return { allowed: false, status: 404 };
    }

    if (ticket.tecnico_asignado === tecnicoId) {
        return { allowed: true };
    }

    const { data: tec } = await supabase
        .from('tecnicos')
        .select('especialidad')
        .eq('id', tecnicoId)
        .maybeSingle();

    if (ticket.estado === 'pendiente') {
        const sinAsignar = ticket.tecnico_asignado == null;
        const categoriaOk = ticket.categoria === tec?.especialidad;
        if (sinAsignar && categoriaOk) {
            return { allowed: true };
        }
    }

    return { allowed: false, status: 403 };
};

// Notificar a técnicos disponibles por email cuando hay nuevo ticket
ticketService.notificarTecnicosNuevoTicket = async function(ticket, propiedadDireccion, clienteNombre) {
    try {
        const emailService = require('./emailService');
        let q = supabase
            .from('tecnicos')
            .select('nombre, email')
            .eq('activo', true)
            .eq('ocupado', false);
        q = q.is('deleted_at', null);
        const { data: tecnicos } = await q;

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
