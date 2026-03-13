// ── Rate limiters por ruta ────────────────────────────────────
const rateLimit = require('express-rate-limit');

const message = { error: 'Demasiadas solicitudes. Intenta más tarde.' };

// General — todas las rutas API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message,
});

// Login — más estricto
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
    skipSuccessfulRequests: true,
});

// Registro — prevenir spam
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5,
    message: { error: 'Demasiados registros desde esta IP.' },
});

// Tickets — prevenir flood
const ticketLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10,
    message,
});

// Chat — polling intenso
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60, // máx 1 req/seg de promedio
    message,
});

module.exports = { apiLimiter, loginLimiter, registerLimiter, ticketLimiter, chatLimiter };