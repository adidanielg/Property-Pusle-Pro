const jwt = require('jsonwebtoken');

const requireAuth = (rolesPermitidos = []) => {
    return (req, res, next) => {
        // Leer cookie según el rol de la ruta
        const cookieName = req.baseUrl.includes('/tecnico') ? 'jwt_tecnico'
                         : req.baseUrl.includes('/admin')   ? 'jwt_admin'
                         : 'jwt_cliente';
        const token = req.cookies[cookieName] || req.cookies.jwt; // fallback a jwt para compatibilidad

        const loginUrl = () => {
            if (req.baseUrl.includes('/tecnico')) return '/auth/login-tecnico';
            if (req.baseUrl.includes('/admin'))   return '/auth/login-admin';
            return '/auth/login';
        };

        // Sin token — redirect al login
        if (!token) {
            // Si es petición AJAX/API → devolver JSON
            if (req.xhr || req.headers.accept?.includes('application/json') ||
                req.path.startsWith('/api') || req.method !== 'GET') {
                return res.status(401).json({ error: 'unauthorized', message: 'No autorizado' });
            }
            return res.redirect(loginUrl());
        }

        try {
            const decoded = jwt.verify(token, process.env.SESSION_SECRET);

            // Rol no permitido
            if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(decoded.role)) {
                res.clearCookie('jwt');
                return res.redirect(loginUrl());
            }

            req.user = decoded;
            next();

        } catch (err) {
            res.clearCookie('jwt');
            res.clearCookie(cookieName);
            const expired = err.name === 'TokenExpiredError';

            // Petición AJAX/API — devolver JSON con código claro
            if (req.xhr || req.headers.accept?.includes('application/json') ||
                req.method !== 'GET') {
                return res.status(401).json({
                    error:   expired ? 'session_expired' : 'unauthorized',
                    message: expired ? 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.' : 'No autorizado'
                });
            }

            // Navegación normal — redirect con mensaje en query param
            const url = loginUrl();
            return res.redirect(expired ? `${url}?expired=1` : url);
        }
    };
};

module.exports = { requireAuth };