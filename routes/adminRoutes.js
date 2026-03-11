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
            { data: companias         }
        ] = await Promise.all([
            supabase.from('companias').select('*', { count: 'exact', head: true }),
            supabase.from('tecnicos').select('*',  { count: 'exact', head: true }),
            supabase.from('tickets').select('*',   { count: 'exact', head: true }).neq('estado', 'completado'),
            supabase.from('tickets').select('*',   { count: 'exact', head: true }).eq('estado', 'completado'),
            supabase.from('tickets')
                .select('*, companias(nombre_empresa, nombre_contacto), tecnicos(nombre), propiedades(direccion)')
                .order('created_at', { ascending: false })
                .limit(20),
            supabase.from('companias')
                .select('*')
                .eq('tipo_cliente', 'Individual')
                .order('created_at', { ascending: false }),
            supabase.from('companias')
                .select('*')
                .eq('tipo_cliente', 'Compania')
                .order('created_at', { ascending: false })
        ]);

        res.render('pages/adminDashboard.html', {
            title:    'Admin | PropertyPulse',
            admin:    req.user,
            metricas: {
                totalClientes:    totalClientes    || 0,
                totalTecnicos:    totalTecnicos    || 0,
                ticketsAbiertos:  ticketsAbiertos  || 0,
                ticketsResueltos: ticketsResueltos || 0
            },
            tickets:      ultimosTickets || [],
            individuales: individuales   || [],
            companias:    companias      || []
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

module.exports = router;