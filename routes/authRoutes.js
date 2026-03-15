const express     = require('express');
const router      = express.Router();
const authService = require('../services/authService');
const { validate, schemas } = require('../middleware/validate');

// ── Vistas login ──────────────────────────────────────────────
router.get('/login',         (req, res) => res.render('loginCliente.html', { error: null }));
router.get('/login-tecnico', (req, res) => res.render('loginTecnico.html', { error: null }));
router.get('/login-admin',   (req, res) => res.render('loginAdmin.html',   { error: null }));

// ── Vistas registro ───────────────────────────────────────────
router.get('/register-cliente', (req, res) => res.render('registerCliente.html'));
router.get('/register-tecnico', (req, res) => res.render('registerTecnico.html'));

// ── POST /auth/register ───────────────────────────────────────
router.post('/register', validate(schemas.register), async (req, res) => {
    try {
        const { confirm_password, role, ...userData } = req.body;

        if (!role)
            return res.status(400).json({ error: 'Rol no especificado' });
        if (userData.password !== confirm_password)
            return res.status(400).json({ error: 'Las contraseñas no coinciden' });

        const username = await authService.register(userData, role, req.body.codigo_invitacion);
        res.json({ success: true, username });

    } catch (err) {
        console.error('[REGISTER]', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── POST /auth/login ──────────────────────────────────────────
router.post('/login', validate(schemas.login), async (req, res) => {
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

        // Cookie separada por rol — evita que múltiples sesiones se sobreescriban
        const cookieName = role === 'admin' ? 'jwt_admin' : role === 'tecnico' ? 'jwt_tecnico' : 'jwt_cliente';
        res.cookie(cookieName, token, {
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

        // Si el cliente eligió un plan, redirigir al checkout
        const plan = req.body.plan;
        if (role === 'cliente' && plan && ['starter','pro','business'].includes(plan)) {
            try {
                const stripeService = require('../services/stripeService');
                const baseUrl    = process.env.BASE_URL || 'https://www.getpropertypulse.net';
                const session    = await stripeService.createCheckoutSession(
                    user.id, plan,
                    `${baseUrl}/cliente/dashboard?upgraded=1`,
                    `${baseUrl}/app`
                );
                return res.redirect(session.url);
            } catch (stripeErr) {
                console.error('[STRIPE CHECKOUT]', stripeErr.message);
                // Si falla Stripe, ir al dashboard normal
            }
        }

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

// ── GET /auth/recuperar-usuario ──────────────────────────────
router.get('/recuperar-usuario', (req, res) => {
    res.render('recuperarUsuario.html', { error: null, success: null });
});

// ── POST /auth/recuperar-usuario ─────────────────────────────
router.post('/recuperar-usuario', async (req, res) => {
    const { email } = req.body;
    const isJson = req.headers['content-type']?.includes('application/json');
    if (!email) {
        if (isJson) return res.status(400).json({ error: 'Ingresa tu email' });
        return res.render('recuperarUsuario.html', { error: 'Ingresa tu email', success: null });
    }

    try {
        const supabase = require('../services/supabaseClient');
        const emailService = require('../services/emailService');

        // Buscar en clientes
        let { data: user } = await supabase.from('companias').select('nombre_contacto, email, username').eq('email', email).single();
        let role = 'cliente';

        // Si no está en clientes, buscar en técnicos
        if (!user) {
            const { data: tec } = await supabase.from('tecnicos').select('nombre, email, username').eq('email', email).single();
            if (tec) { user = { nombre_contacto: tec.nombre, email: tec.email, username: tec.username }; role = 'tecnico'; }
        }

        // Siempre mostrar el mismo mensaje por seguridad
        if (user) {
            emailService.enviarRecuperacionUsername({
                nombre:   user.nombre_contacto,
                email:    user.email,
                username: user.username,
                role
            });
        }

        const msg = 'Si ese email está registrado, recibirás tu usuario en los próximos minutos.';
        if (isJson) return res.json({ success: true, message: msg });
        res.render('recuperarUsuario.html', { error: null, success: msg });
    } catch (err) {
        console.error('[RECUPERAR]', err.message);
        if (req.headers['content-type']?.includes('application/json'))
            return res.status(500).json({ error: 'Error procesando solicitud' });
        res.render('recuperarUsuario.html', { error: 'Error procesando solicitud', success: null });
    }
});

// ── POST /auth/solicitar-reset ───────────────────────────────
// Solicitar reset de contraseña — genera token y envía email
router.post('/solicitar-reset', async (req, res) => {
    const { email, username } = req.body;
    if (!email || !username) {
        return res.status(400).json({ error: 'Email y usuario son requeridos' });
    }

    try {
        const crypto   = require('crypto');
        const supabase = require('../services/supabaseClient');
        const emailService = require('../services/emailService');

        // Buscar en clientes primero
        let user = null, role = 'cliente', nombre = '';
        const { data: cli } = await supabase.from('companias')
            .select('id, nombre_contacto, email, username')
            .eq('email', email).eq('username', username).single();

        if (cli) { user = cli; nombre = cli.nombre_contacto; }

        // Si no, buscar en técnicos
        if (!user) {
            const { data: tec } = await supabase.from('tecnicos')
                .select('id, nombre, email, username')
                .eq('email', email).eq('username', username).single();
            if (tec) { user = tec; role = 'tecnico'; nombre = tec.nombre; }
        }

        // Siempre responder igual por seguridad
        if (user) {
            const token     = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

            // Invalidar tokens anteriores del usuario
            await supabase.from('password_reset_tokens')
                .update({ used: true })
                .eq('user_id', user.id).eq('used', false);

            // Crear nuevo token
            await supabase.from('password_reset_tokens').insert({
                user_id:    user.id,
                user_role:  role,
                token,
                expires_at: expiresAt.toISOString()
            });

            const baseUrl  = process.env.BASE_URL || 'https://www.getpropertypulse.net';
            const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

            emailService.enviarResetPassword({ nombre, email: user.email, resetUrl });
        }

        res.json({ success: true, message: 'Si los datos son correctos, recibirás un email con el link.' });
    } catch (err) {
        console.error('[RESET]', err.message);
        res.status(500).json({ error: 'Error procesando solicitud' });
    }
});

// ── GET /auth/reset-password ──────────────────────────────────
// Página para ingresar nueva contraseña
router.get('/reset-password', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.redirect('/auth/login');

    try {
        const supabase = require('../services/supabaseClient');
        const { data } = await supabase.from('password_reset_tokens')
            .select('*').eq('token', token).eq('used', false).single();

        if (!data || new Date(data.expires_at) < new Date()) {
            return res.render('resetPassword.html', { error: 'El link ha expirado o ya fue usado.', token: null, success: null });
        }

        res.render('resetPassword.html', { error: null, token, success: null });
    } catch (err) {
        res.render('resetPassword.html', { error: 'Link inválido.', token: null, success: null });
    }
});

// ── POST /auth/reset-password ─────────────────────────────────
// Procesar nueva contraseña
router.post('/reset-password', async (req, res) => {
    const { token, password, confirm_password } = req.body;

    if (!token) return res.render('resetPassword.html', { error: 'Token inválido', token: null, success: null });
    if (!password || password.length < 6) return res.render('resetPassword.html', { error: 'La contraseña debe tener al menos 6 caracteres', token, success: null });
    if (password !== confirm_password) return res.render('resetPassword.html', { error: 'Las contraseñas no coinciden', token, success: null });

    try {
        const bcrypt   = require('bcryptjs');
        const supabase = require('../services/supabaseClient');

        // Verificar token
        const { data: resetData } = await supabase.from('password_reset_tokens')
            .select('*').eq('token', token).eq('used', false).single();

        if (!resetData || new Date(resetData.expires_at) < new Date()) {
            return res.render('resetPassword.html', { error: 'El link ha expirado. Solicita uno nuevo.', token: null, success: null });
        }

        // Actualizar contraseña
        const hashed = await bcrypt.hash(password, 10);
        const table  = resetData.user_role === 'tecnico' ? 'tecnicos' : 'companias';

        await supabase.from(table).update({ password: hashed }).eq('id', resetData.user_id);

        // Marcar token como usado
        await supabase.from('password_reset_tokens').update({ used: true }).eq('token', token);

        res.render('resetPassword.html', { error: null, token: null, success: '✅ Contraseña actualizada. Ya puedes iniciar sesión.' });
    } catch (err) {
        console.error('[RESET PASSWORD]', err.message);
        res.render('resetPassword.html', { error: 'Error actualizando contraseña', token, success: null });
    }
});

// ── GET /auth/logout ──────────────────────────────────────────
router.get('/logout', (req, res) => {
    res.clearCookie('jwt');
    res.clearCookie('jwt_cliente');
    res.clearCookie('jwt_tecnico');
    res.clearCookie('jwt_admin');
    res.redirect('/');
});

module.exports = router;