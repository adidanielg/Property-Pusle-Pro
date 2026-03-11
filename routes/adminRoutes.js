const express    = require('express');
const router     = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const supabase   = require('../services/supabaseClient');

router.use(requireAuth(['admin']));

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const [
            { count: totalClientes    },
            { count: totalTecnicos    },
            { count: ticketsAbiertos  },
            { count: ticketsResueltos },
            { data: ultimosTickets    },
            { data: individuales      },
            { data: companias         },
            { data: tecnicos          },
            { data: calificaciones    }
        ] = await Promise.all([
            supabase.from('companias').select('*', { count: 'exact', head: true }),
            supabase.from('tecnicos').select('*',  { count: 'exact', head: true }),
            supabase.from('tickets').select('*',   { count: 'exact', head: true }).neq('estado', 'completado'),
            supabase.from('tickets').select('*',   { count: 'exact', head: true }).eq('estado', 'completado'),
            supabase.from('tickets')
                .select('*, companias(nombre_empresa, nombre_contacto), tecnicos:tecnico_asignado(nombre), propiedades(direccion)')
                .order('created_at', { ascending: false })
                .limit(200),
            supabase.from('companias')
                .select('*')
                .eq('tipo_cliente', 'Individual')
                .order('created_at', { ascending: false }),
            supabase.from('companias')
                .select('*')
                .eq('tipo_cliente', 'Compania')
                .order('created_at', { ascending: false }),
            supabase.from('tecnicos')
                .select('id, nombre, email, telefono, especialidad, activo, created_at')
                .order('created_at', { ascending: false }),
            supabase.from('calificaciones')
                .select('tecnico_id, estrellas')
        ]);

        // Calcular promedio y total de reseñas por técnico
        const statsCalif = {};
        (calificaciones || []).forEach(c => {
            if (!statsCalif[c.tecnico_id]) statsCalif[c.tecnico_id] = { suma: 0, total: 0 };
            statsCalif[c.tecnico_id].suma  += c.estrellas;
            statsCalif[c.tecnico_id].total += 1;
        });

        const tecnicosConRating = (tecnicos || []).map(t => ({
            ...t,
            promedio:   statsCalif[t.id] ? (statsCalif[t.id].suma / statsCalif[t.id].total).toFixed(1) : null,
            totalCalif: statsCalif[t.id]?.total || 0
        }));

        res.render('adminDashboard.html', {
            title:    'Admin | PropertyPulse',
            admin:    req.user,
            metricas: {
                totalClientes:    totalClientes    || 0,
                totalTecnicos:    totalTecnicos    || 0,
                ticketsAbiertos:  ticketsAbiertos  || 0,
                ticketsResueltos: ticketsResueltos || 0
            },
            tickets:      ultimosTickets    || [],
            individuales: individuales      || [],
            companias:    companias         || [],
            tecnicos:     tecnicosConRating || []
        });

    } catch (err) {
        console.error('[ADMIN DASHBOARD]', err);
        res.status(500).send('Error cargando el panel');
    }
});

// ── Editar cliente ────────────────────────────────────────────
router.put('/clientes/:id', async (req, res) => {
    try {
        const { nombre_contacto, nombre_empresa, email, telefono, tipo_cliente } = req.body;
        const { data, error } = await supabase
            .from('companias')
            .update({ nombre_contacto, nombre_empresa, email, telefono, tipo_cliente })
            .eq('id', req.params.id)
            .select().single();
        if (error) throw error;
        res.json({ success: true, cliente: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Eliminar cliente ──────────────────────────────────────────
router.delete('/clientes/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('companias')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Editar técnico ────────────────────────────────────────────
router.put('/tecnicos/:id', async (req, res) => {
    try {
        const { nombre, email, telefono, especialidad, activo } = req.body;
        const { data, error } = await supabase
            .from('tecnicos')
            .update({ nombre, email, telefono, especialidad, activo })
            .eq('id', req.params.id)
            .select().single();
        if (error) throw error;
        res.json({ success: true, tecnico: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Eliminar técnico ──────────────────────────────────────────
router.delete('/tecnicos/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('tecnicos')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;