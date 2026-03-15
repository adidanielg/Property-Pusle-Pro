const express    = require('express');
const router     = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const supabase   = require('../services/supabaseClient');
const { validate, schemas } = require('../middleware/validate');
const feeService = require('../services/feeService');

router.use(requireAuth(['admin']));

const PAGE_SIZE = 20;

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
            // Solo primera página al cargar
            supabase.from('tickets')
                .select('*, companias(nombre_empresa, nombre_contacto), tecnicos:tecnico_asignado(nombre), propiedades(direccion)')
                .order('created_at', { ascending: false })
                .range(0, PAGE_SIZE - 1),
            supabase.from('companias')
                .select('*, propiedades(id, direccion, servicios_contratados)')
                .eq('tipo_cliente', 'Individual')
                .order('created_at', { ascending: false }),
            supabase.from('companias')
                .select('*, propiedades(id, direccion, servicios_contratados)')
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

        // Total de tickets para paginación
        const { count: totalTickets } = await supabase
            .from('tickets').select('*', { count: 'exact', head: true });

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
            totalTickets: totalTickets      || 0,
            pageSize:     PAGE_SIZE,
            individuales: individuales      || [],
            companias:    companias         || [],
            tecnicos:     tecnicosConRating || []
        });

    } catch (err) {
        console.error('[ADMIN DASHBOARD]', err);
        res.status(500).send('Error cargando el panel');
    }
});

// ── Tickets paginados (API) ───────────────────────────────────
router.get('/tickets', async (req, res) => {
    try {
        const page     = Math.max(1, parseInt(req.query.page)   || 1);
        const estado   = req.query.estado   || null;
        const categoria= req.query.categoria|| null;
        const search   = req.query.search   || null;
        const from     = (page - 1) * PAGE_SIZE;
        const to       = from + PAGE_SIZE - 1;

        let query = supabase
            .from('tickets')
            .select('*, companias(nombre_empresa, nombre_contacto), tecnicos:tecnico_asignado(nombre), propiedades(direccion)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to);

        if (estado)    query = query.eq('estado', estado);
        if (categoria) query = query.eq('categoria', categoria);
        if (search)    query = query.ilike('motivo', `%${search}%`);

        const { data, count, error } = await query;
        if (error) throw error;

        res.json({
            success:    true,
            tickets:    data || [],
            total:      count || 0,
            page,
            pageSize:   PAGE_SIZE,
            totalPages: Math.ceil((count || 0) / PAGE_SIZE)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Editar cliente ────────────────────────────────────────────
router.put('/clientes/:id', validate(schemas.editarCliente), async (req, res) => {
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
router.put('/tecnicos/:id', validate(schemas.editarTecnico), async (req, res) => {
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

// ── Log de cancelaciones ──────────────────────────────────────
router.get('/cancelaciones', async (req, res) => {
    try {
        const { data } = await supabase
            .from('cancelaciones')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        res.json({ success: true, cancelaciones: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ── Fees pendientes por técnico ───────────────────────────────
router.get('/fees', async (req, res) => {
    try {
        const { data } = await supabase
            .from('resumen_fees')
            .select('*')
            .order('fee_pendiente', { ascending: false });
        res.json({ success: true, fees: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Marcar fees como cobrados ─────────────────────────────────
router.post('/fees/:tecnicoId/cobrar', async (req, res) => {
    try {
        await feeService.marcarCobrado(req.params.tecnicoId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /admin/codigos ────────────────────────────────────────
router.get('/codigos', async (req, res) => {
    try {
        const { data } = await supabase
            .from('codigos_invitacion')
            .select('*, tecnicos:usado_por(nombre)')
            .order('created_at', { ascending: false });
        res.json({ success: true, codigos: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /admin/codigos ───────────────────────────────────────
router.post('/codigos', async (req, res) => {
    try {
        const crypto = require('crypto');
        // Generar código legible: PP-XXXX-XXXX
        const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const codigo = `PP-${part1}-${part2}`;

        const { data, error } = await supabase
            .from('codigos_invitacion')
            .insert({ codigo, creado_por: 'admin' })
            .select().single();

        if (error) throw error;
        res.json({ success: true, codigo: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── DELETE /admin/codigos/:id ────────────────────────────────
router.delete('/codigos/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('codigos_invitacion')
            .delete()
            .eq('id', req.params.id)
            .eq('usado', false); // Solo eliminar si no fue usado
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;