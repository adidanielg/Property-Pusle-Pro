const express     = require('express');
const router      = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const supabase    = require('../services/supabaseClient');

router.use(requireAuth(['admin']));

// ── Dashboard ────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const [
            { count: totalClientes  },
            { count: totalTecnicos  },
            { count: ticketsAbiertos },
            { count: ticketsResueltos },
            { data:  ultimosTickets }
        ] = await Promise.all([
            supabase.from('companias').select('*', { count: 'exact', head: true }),
            supabase.from('tecnicos').select('*',  { count: 'exact', head: true }),
            supabase.from('tickets').select('*',   { count: 'exact', head: true }).neq('estado', 'completado'),
            supabase.from('tickets').select('*',   { count: 'exact', head: true }).eq('estado', 'completado'),
            supabase.from('tickets')
                .select('*, companias(nombre_empresa), tecnicos(nombre), propiedades(direccion)')
                .order('created_at', { ascending: false })
                .limit(20)
        ]);

        res.render('pages/adminDashboard.html', {
            title:   'Admin | PropertyPulse',
            admin:   req.user,
            metricas: {
                totalClientes:    totalClientes    || 0,
                totalTecnicos:    totalTecnicos    || 0,
                ticketsAbiertos:  ticketsAbiertos  || 0,
                ticketsResueltos: ticketsResueltos || 0
            },
            tickets: ultimosTickets || []
        });

    } catch (err) {
        console.error('[ADMIN DASHBOARD]', err);
        res.status(500).send('Error cargando el panel de administración');
    }
});

module.exports = router;