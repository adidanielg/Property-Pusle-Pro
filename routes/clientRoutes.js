const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const { requireAuth }     = require('../middleware/authMiddleware');
const supabase            = require('../services/supabaseClient');
const notificationService = require('../services/notificationService');

const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth(['cliente']));

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const id = req.user.id;
        const [{ data: propiedades }, { data: tickets }, { data: misCalificaciones }] = await Promise.all([
            supabase.from('propiedades')
                .select('*')
                .eq('compania_id', id)
                .order('created_at', { ascending: false }),
            supabase.from('tickets')
                .select('*, propiedades(direccion), tecnicos:tecnico_asignado(nombre)')
                .eq('cliente_id', id)
                .order('created_at', { ascending: false }),
            supabase.from('calificaciones')
                .select('ticket_id')
                .eq('cliente_id', id)
        ]);

        // IDs de tickets ya calificados
        const ticketsCalificados = new Set((misCalificaciones || []).map(c => c.ticket_id));

        res.render('pages/dashboardCliente.html', {
            title:              'Mi Panel | PropertyPulse',
            cliente:            req.user,
            propiedades:        propiedades        || [],
            tickets:            tickets            || [],
            ticketsCalificados
        });
    } catch (err) {
        console.error('[CLIENT DASHBOARD]', err);
        res.status(500).send('Error cargando el panel');
    }
});

// ── Crear ticket → notificar técnicos ─────────────────────────
router.post('/tickets', upload.single('foto'), async (req, res) => {
    try {
        const { propiedad_id, categoria, motivo, descripcion } = req.body;
        let foto_url = null;

        if (req.file) {
            const ext      = req.file.mimetype.split('/')[1];
            const fileName = `ticket-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage
                .from('tickets-fotos')
                .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

            if (!upErr) {
                const { data: urlData } = supabase.storage
                    .from('tickets-fotos')
                    .getPublicUrl(fileName);
                foto_url = urlData.publicUrl;
            }
        }

        const { data: ticket, error } = await supabase
            .from('tickets')
            .insert([{ propiedad_id, cliente_id: req.user.id, motivo, descripcion, categoria, estado: 'pendiente', foto_url }])
            .select('*, propiedades(direccion), tecnicos:tecnico_asignado(nombre)')
            .single();

        if (error) throw error;

        notificationService.notificarTecnicos(ticket)
            .catch(err => console.error('[PUSH técnicos]', err.message));

        res.status(201).json({ success: true, ticket });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Calificar técnico ─────────────────────────────────────────
router.post('/calificar', async (req, res) => {
    try {
        const { ticket_id, estrellas, comentario } = req.body;

        // Verificar que el ticket pertenece a este cliente y está completado
        const { data: ticket, error: tErr } = await supabase
            .from('tickets')
            .select('id, cliente_id, tecnico_asignado, estado')
            .eq('id', ticket_id)
            .eq('cliente_id', req.user.id)
            .eq('estado', 'completado')
            .single();

        if (tErr || !ticket)
            return res.status(403).json({ error: 'Ticket no válido para calificar' });

        if (!ticket.tecnico_asignado)
            return res.status(400).json({ error: 'Este ticket no tiene técnico asignado' });

        // Insertar calificación (UNIQUE en ticket_id previene duplicados)
        const { data, error } = await supabase
            .from('calificaciones')
            .insert([{
                ticket_id,
                cliente_id: req.user.id,
                tecnico_id: ticket.tecnico_asignado,
                estrellas:  parseInt(estrellas),
                comentario: comentario || null
            }])
            .select().single();

        if (error) {
            if (error.code === '23505')
                return res.status(400).json({ error: 'Ya calificaste este servicio' });
            throw error;
        }

        res.json({ success: true, calificacion: data });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Propiedades CRUD ──────────────────────────────────────────
router.post('/propiedades', async (req, res) => {
    try {
        const { direccion, servicios_contratados } = req.body;
        const { data, error } = await supabase
            .from('propiedades')
            .insert([{ direccion, servicios_contratados, compania_id: req.user.id }])
            .select().single();
        if (error) throw error;
        res.json({ success: true, propiedad: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/propiedades/:id', async (req, res) => {
    try {
        const { direccion, servicios_contratados } = req.body;
        const { data, error } = await supabase
            .from('propiedades')
            .update({ direccion, servicios_contratados })
            .eq('id', req.params.id)
            .eq('compania_id', req.user.id)
            .select().single();
        if (error) throw error;
        res.json({ success: true, propiedad: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/propiedades/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('propiedades')
            .delete()
            .eq('id', req.params.id)
            .eq('compania_id', req.user.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;