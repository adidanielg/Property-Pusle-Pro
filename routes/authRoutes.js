const express     = require('express');
const router      = express.Router();
const authService = require('../services/authService');

// ── Vistas login ──────────────────────────────────────────────
router.get('/login',         (req, res) => res.render('loginCliente.html', { error: null }));
router.get('/login-tecnico', (req, res) => res.render('loginTecnico.html', { error: null }));
router.get('/login-admin',   (req, res) => res.render('loginAdmin.html',   { error: null }));

// ── Vistas registro ───────────────────────────────────────────
router.get('/register-cliente', (req, res) => res.render('registerCliente.html'));
router.get('/register-tecnico', (req, res) => res.render('registerTecnico.html'));

// ── POST /auth/register ───────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { confirm_password, role, ...userData } = req.body;

        if (!role)
            return res.status(400).json({ error: 'Rol no especificado' });
        if (userData.password !== confirm_password)
            return res.status(400).json({ error: 'Las contraseñas no coinciden' });

        const username = await authService.register(userData, role);
        res.json({ success: true, username });

    } catch (err) {
        console.error('[REGISTER]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /auth/login ──────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { username, password, role } = req.body;

    const vistas = {
        cliente: 'loginCliente.html',
        tecnico: 'loginTecnico.html',
        admin:   'loginAdmin.html'
    };
    const vista = vistas[role] || 'loginCliente.html';

    try {
        if (!role) throw new Error('Rol no especificado');

        const { token, user } = await authService.login(username, password, role);

        res.cookie('jwt', token, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge:   8 * 60 * 60 * 1000 // 8 horas
        });

        // Sincronizar tema guardado en Supabase al browser
        if (user?.theme) {
            res.cookie('pp_theme', user.theme, {
                httpOnly: false,
                secure:   process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge:   365 * 24 * 60 * 60 * 1000
            });
        }

        // Sincronizar idioma guardado en Supabase al browser
        if (user?.lang) {
            res.cookie('pp_lang', user.lang, {
                httpOnly: false,
                secure:   process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge:   365 * 24 * 60 * 60 * 1000
            });
        }

        const dashboards = {
            cliente: '/cliente/dashboard',
            tecnico: '/tecnico/dashboard',
            admin:   '/admin/dashboard'
        };
        return res.redirect(dashboards[role]);

    } catch (err) {
        console.error('[LOGIN]', err.message);
        return res.status(401).render(vista, { error: err.message });
    }
});

// ── POST /auth/set-theme ──────────────────────────────────────
router.post('/set-theme', async (req, res) => {
    try {
        const jwt = require('jsonwebtoken');
        const token = req.cookies?.jwt;
        if (!token) return res.json({ success: false });

        const decoded = jwt.verify(token, process.env.SESSION_SECRET);
        const { theme } = req.body;
        if (!['light', 'dark'].includes(theme)) return res.status(400).json({ error: 'Invalid theme' });

        const supabase = require('../services/supabaseClient');
        const table = decoded.role === 'tecnico' ? 'tecnicos' : 'companias';

        if (decoded.role !== 'admin') {
            await supabase.from(table).update({ theme }).eq('id', decoded.id);
        }

        res.cookie('pp_theme', theme, {
            httpOnly: false,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge:   365 * 24 * 60 * 60 * 1000
        });

        res.json({ success: true });
    } catch (err) {
        res.json({ success: false });
    }
});

// ── POST /auth/set-lang ───────────────────────────────────────
router.post('/set-lang', async (req, res) => {
    try {
        const jwt = require('jsonwebtoken');
        const token = req.cookies?.jwt;
        if (!token) return res.json({ success: false });

        const decoded = jwt.verify(token, process.env.SESSION_SECRET);
        const { lang } = req.body;
        if (!['es', 'en'].includes(lang)) return res.status(400).json({ error: 'Invalid lang' });

        const supabase = require('../services/supabaseClient');
        const table = decoded.role === 'tecnico' ? 'tecnicos' : 'companias';

        if (decoded.role !== 'admin') {
            await supabase.from(table).update({ lang }).eq('id', decoded.id);
        }
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false });
    }
});

// ── GET /auth/logout ──────────────────────────────────────────
router.get('/logout', (req, res) => {
    res.clearCookie('jwt');
    res.redirect('/');
});

module.exports = router;