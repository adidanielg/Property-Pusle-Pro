const jwt = require('jsonwebtoken');

const requireAuth = (rolesPermitidos = []) => {
    return (req, res, next) => {
        const token = req.cookies.jwt;

        if (!token) {
            if (req.baseUrl.includes('/tecnico')) return res.redirect('/auth/login-tecnico');
            if (req.baseUrl.includes('/admin'))   return res.redirect('/auth/login-admin');
            return res.redirect('/auth/login');
        }

        try {
            const decoded = jwt.verify(token, process.env.SESSION_SECRET);

            if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(decoded.role)) {
                res.clearCookie('jwt');
                if (req.baseUrl.includes('/tecnico')) return res.redirect('/auth/login-tecnico');
                if (req.baseUrl.includes('/admin'))   return res.redirect('/auth/login-admin');
                return res.redirect('/auth/login');
            }

            req.user = decoded;
            next();

        } catch (err) {
            res.clearCookie('jwt');
            if (req.baseUrl.includes('/tecnico')) return res.redirect('/auth/login-tecnico');
            if (req.baseUrl.includes('/admin'))   return res.redirect('/auth/login-admin');
            return res.redirect('/auth/login');
        }
    };
};

module.exports = { requireAuth };