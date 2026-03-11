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

        const { token } = await authService.login(username, password, role);

        res.cookie('jwt', token, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge:   8 * 60 * 60 * 1000 // 8 horas
        });

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

// ── GET /auth/logout ──────────────────────────────────────────
router.get('/logout', (req, res) => {
    res.clearCookie('jwt');
    res.redirect('/');
});

module.exports = router;