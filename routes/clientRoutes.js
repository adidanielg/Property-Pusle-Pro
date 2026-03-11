const express     = require('express');
const router      = express.Router();
const multer      = require('multer');
const { requireAuth } = require('../middleware/authMiddleware');
const supabase    = require('../services/supabaseClient');

const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth(['cliente']));

// ── Dashboard ────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const id = req.user.id;

        const [{ data: propiedades }, { data: tickets }] = await Promise.all([
            supabase.from('propiedades').select('*').eq('compania_id', id).order('created_at', { ascending: false }),
            supabase.from('tickets').select('*, propiedades(direccion)').eq('cliente_id', id).order('created_at', { ascending: false })
        ]);

        res.render('pages/dashboardCliente.html', {
            title:       'Mi Panel | PropertyPulse',
            cliente:     req.user,
            propiedades: propiedades || [],
            tickets:     tickets     || []
        });
    } catch (err) {
        console.error('[CLIENT DASHBOARD]', err);
        res.status(500).send('Error cargando el panel');
    }
});

// ── Tickets ──────────────────────────────────────────────────
router.post('/tickets', upload.single('foto'), async (req, res) => {
    try {
        const { propiedad_id, motivo, descripcion } = req.body;
        let foto_url = null;

        if (req.file) {
            const fileName = `ticket-${Date.now()}.${req.file.mimetype.split('/')[1]}`;
            const { error: upErr } = await supabase.storage
                .from('tickets-fotos')
                .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

            if (!upErr) {
                const { data: urlData } = supabase.storage.from('tickets-fotos').getPublicUrl(fileName);
                foto_url = urlData.publicUrl;
            }
        }

        const { data: ticket, error } = await supabase
            .from('tickets')
            .insert([{ propiedad_id, cliente_id: req.user.id, motivo, descripcion, estado: 'pendiente', foto_url }])
            .select('*, propiedades(direccion)')
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, ticket });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Propiedades CRUD ─────────────────────────────────────────
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
            .eq('id', req.params.id).eq('compania_id', req.user.id)
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
            .eq('id', req.params.id).eq('compania_id', req.user.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;