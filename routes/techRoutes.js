const express     = require('express');
const router      = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const ticketService   = require('../services/ticketService');
const supabase        = require('../services/supabaseClient');
const { validate, schemas } = require('../middleware/validate');

router.use(requireAuth(['tecnico']));

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const [tickets, { data: calificaciones }, { data: tecnicoData }] = await Promise.all([
            ticketService.getTicketsParaTecnico(req.user.id),
            supabase.from('calificaciones')
                .select('estrellas, comentario, created_at, companias:cliente_id(nombre_contacto, nombre_empresa)')
                .eq('tecnico_id', req.user.id)
                .order('created_at', { ascending: false }),
            supabase.from('tecnicos').select('ocupado, suscripcion_activa, invitado, trabajos_completados').eq('id', req.user.id).single()
        ]);

        const totalCalif = calificaciones?.length || 0;
        const promedio   = totalCalif > 0
            ? (calificaciones.reduce((acc, c) => acc + c.estrellas, 0) / totalCalif).toFixed(1)
            : null;

        res.render('dashboardTecnico.html', {
            title:          'Panel Técnico | PropertyPulse',
            tecnico:        { 
                ...req.user, 
                ocupado:              tecnicoData?.ocupado              || false,
                suscripcion_activa:   tecnicoData?.suscripcion_activa   || false,
                invitado:             tecnicoData?.invitado             || false,
                trabajos_completados: tecnicoData?.trabajos_completados || 0,
            },
            tickets:        tickets        || [],
            calificaciones: calificaciones || [],
            promedio,
            totalCalif,
            fees: null
        });
    } catch (err) {
        console.error('[TECH DASHBOARD]', err);
        res.status(500).send('Error cargando el panel');
    }
});

// ── Cambiar estado ────────────────────────────────────────────
router.post('/tickets/:id/estado', validate(schemas.estadoTicket), async (req, res) => {
    try {
        const { estado } = req.body;

        const { data: ticket, error: fetchErr } = await supabase
            .from('tickets')
            .select('id, tecnico_asignado, estado')
            .eq('id', req.params.id)
            .single();

        if (fetchErr || !ticket)
            return res.status(404).json({ error: 'Ticket no encontrado' });

        if (ticket.estado !== 'pendiente' && ticket.tecnico_asignado !== req.user.id)
            return res.status(403).json({ error: 'No tienes permiso para modificar este ticket' });

        if (ticket.estado === 'completado')
            return res.status(400).json({ error: 'Este ticket ya está completado' });

        // Verificar suscripción solo al ACEPTAR (en_proceso)
        if (estado === 'en_proceso') {
            const { data: tec } = await supabase
                .from('tecnicos')
                .select('suscripcion_activa, invitado, trabajos_completados')
                .eq('id', req.user.id)
                .single();

            const primerTrabajo  = (tec?.trabajos_completados || 0) === 0;
            const puedeTrabajar  = tec?.suscripcion_activa === true || 
                                   tec?.invitado           === true || 
                                   primerTrabajo;

            if (!puedeTrabajar) {
                return res.status(403).json({
                    error:        'sin_suscripcion',
                    message:      'Necesitas una suscripción activa para aceptar trabajos.',
                    checkout_url: '/stripe/checkout-tecnico'
                });
            }
        }

        const ticketActualizado = await ticketService.actualizarEstado(
            req.params.id, req.user.id, estado
        );

        // Incrementar contador al completar trabajo
        if (estado === 'completado') {
            await supabase.rpc('incrementar_trabajos_completados', { tecnico_uuid: req.user.id })
                .catch(err => console.error('[COUNTER]', err.message));
        }

        res.json({ success: true, ticket: ticketActualizado });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});





// ── Perfil: obtener ───────────────────────────────────────────
router.get('/perfil', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tecnicos')
            .select('id, nombre, email, telefono, especialidad')
            .eq('id', req.user.id)
            .single();
        if (error) throw error;
        res.json({ success: true, perfil: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Perfil: actualizar ────────────────────────────────────────
router.put('/perfil', validate(schemas.perfilTecnico), async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const { nombre, email, telefono, especialidad, password, nueva_password } = req.body;

        if (nueva_password) {
            const { data: user } = await supabase
                .from('tecnicos').select('password').eq('id', req.user.id).single();
            const valid = await bcrypt.compare(password, user.password);
            if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
        }

        const updates = { nombre, email, telefono, especialidad };
        if (nueva_password) updates.password = await bcrypt.hash(nueva_password, 10);

        const { data, error } = await supabase
            .from('tecnicos')
            .update(updates)
            .eq('id', req.user.id)
            .select('id, nombre, email, telefono, especialidad')
            .single();

        if (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Ese email ya está en uso' });
            throw error;
        }
        res.json({ success: true, perfil: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Cancelar ticket ───────────────────────────────────────────
router.post('/tickets/:id/cancelar', validate(schemas.cancelarTicket), async (req, res) => {
    try {
        const { motivo } = req.body;
        const { data: ticket } = await supabase
            .from('tickets').select('id, motivo, categoria, cliente_id, tecnico_asignado')
            .eq('id', req.params.id).eq('tecnico_asignado', req.user.id).single();

        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

        await supabase.from('tickets')
            .update({ estado: 'pendiente', tecnico_asignado: null })
            .eq('id', ticket.id);

        // Liberar al técnico cuando cancela
        await supabase.from('tecnicos')
            .update({ ocupado: false })
            .eq('id', req.user.id);

        const { data: tec } = await supabase
            .from('tecnicos').select('nombre').eq('id', req.user.id).single();

        await supabase.from('cancelaciones').insert({
            ticket_id:      ticket.id,
            cancelado_por:  'tecnico',
            usuario_id:     req.user.id,
            usuario_nombre: tec?.nombre || 'Técnico',
            motivo:         motivo || 'Sin motivo',
            categoria:      ticket.categoria,
            titulo:         ticket.motivo
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Chat: obtener mensajes ────────────────────────────────────
router.get('/tickets/:id/mensajes', async (req, res) => {
    try {
        const { data } = await supabase
            .from('ticket_mensajes')
            .select('*')
            .eq('ticket_id', req.params.id)
            .order('created_at', { ascending: true });
        res.json({ success: true, mensajes: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Chat: enviar mensaje ──────────────────────────────────────
router.post('/tickets/:id/mensajes', validate(schemas.mensajeChat), async (req, res) => {
    try {
        const { mensaje } = req.body;
        const { data: tec } = await supabase
            .from('tecnicos').select('nombre').eq('id', req.user.id).single();

        const { data } = await supabase.from('ticket_mensajes').insert({
            ticket_id:    req.params.id,
            autor_id:     req.user.id,
            autor_nombre: tec?.nombre || 'Técnico',
            autor_rol:    'tecnico',
            mensaje:      mensaje.trim()
        }).select().single();

        res.json({ success: true, mensaje: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Eliminar cuenta ───────────────────────────────────────────
router.delete('/cuenta', async (req, res) => {
    try {
        const id = req.user.id;
        await supabase.from('tecnicos').update({ push_subscription: null }).eq('id', id);
        await supabase.from('tecnicos').delete().eq('id', id);
        res.clearCookie('jwt');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Cotizaciones: enviar ──────────────────────────────────────
router.post('/tickets/:id/cotizar', async (req, res) => {
    try {
        const { precio, descripcion } = req.body;

        if (!precio || isNaN(precio) || precio <= 0)
            return res.status(400).json({ error: 'Precio inválido' });
        if (!descripcion || descripcion.trim().length < 5)
            return res.status(400).json({ error: 'Descripción requerida' });

        // Verificar que el ticket existe, es de su categoría y está pendiente
        const { data: ticket } = await supabase
            .from('tickets')
            .select('id, estado, cliente_id, categoria, motivo')
            .eq('id', req.params.id)
            .single();

        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
        if (!['pendiente'].includes(ticket.estado))
            return res.status(400).json({ error: 'Este ticket ya no está disponible' });

        // Verificar que no haya enviado cotización previa para este ticket
        const { data: existente } = await supabase
            .from('cotizaciones')
            .select('id')
            .eq('ticket_id', req.params.id)
            .eq('tecnico_id', req.user.id)
            .eq('estado', 'pendiente')
            .single();

        if (existente) return res.status(400).json({ error: 'Ya enviaste una cotización para este ticket' });

        // Crear cotización
        const { data: cotizacion, error } = await supabase
            .from('cotizaciones')
            .insert({
                ticket_id:   req.params.id,
                tecnico_id:  req.user.id,
                cliente_id:  ticket.cliente_id,
                precio:      parseFloat(precio),
                descripcion: descripcion.trim()
            })
            .select()
            .single();

        if (error) throw error;

        // Cambiar estado del ticket a 'cotizando'
        await supabase.from('tickets')
            .update({ estado: 'cotizando', tecnico_asignado: req.user.id })
            .eq('id', req.params.id);

        // Notificar al cliente
        const { data: tec } = await supabase
            .from('tecnicos').select('nombre').eq('id', req.user.id).single();

        const notificationService = require('../services/notificationService');
        notificationService.notificarClienteConTecnico(
            ticket.cliente_id, 'cotizacion', ticket, tec?.nombre || 'El técnico'
        ).catch(() => {});

        // Email al cliente
        try {
            const emailService = require('../services/emailService');
            const { data: cliente } = await supabase
                .from('companias').select('email, nombre_contacto').eq('id', ticket.cliente_id).single();
            if (cliente?.email) {
                emailService.enviarCotizacion({
                    clienteNombre: cliente.nombre_contacto,
                    clienteEmail:  cliente.email,
                    tecnicoNombre: tec?.nombre || 'Técnico',
                    motivo:        ticket.motivo,
                    precio:        parseFloat(precio),
                    descripcion:   descripcion.trim(),
                    cotizacionId:  cotizacion.id
                }).catch(() => {});
            }
        } catch {}

        res.json({ success: true, cotizacion });
    } catch (err) {
        console.error('[COTIZAR]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Cotizaciones: ver las del técnico ─────────────────────────
router.get('/cotizaciones', async (req, res) => {
    try {
        const { data } = await supabase
            .from('cotizaciones')
            .select('*, tickets(motivo, categoria, propiedades(direccion))')
            .eq('tecnico_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(50);
        res.json({ success: true, cotizaciones: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;