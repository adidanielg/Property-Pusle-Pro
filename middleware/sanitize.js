// ── Sanitización de inputs contra XSS ────────────────────────
const xss = require('xss');

// Opciones restrictivas — solo texto plano, sin HTML
const xssOptions = {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
};

function sanitizeValue(value) {
    if (typeof value === 'string') return xss(value.trim(), xssOptions);
    if (typeof value === 'object' && value !== null) return sanitizeObject(value);
    return value;
}

function sanitizeObject(obj) {
    const clean = {};
    for (const key of Object.keys(obj)) {
        clean[key] = sanitizeValue(obj[key]);
    }
    return clean;
}

// Middleware — sanitiza req.body, req.query y req.params
function sanitizeInputs(req, res, next) {
    if (req.body)   req.body   = sanitizeObject(req.body);
    if (req.query)  req.query  = sanitizeObject(req.query);
    if (req.params) req.params = sanitizeObject(req.params);
    next();
}

module.exports = sanitizeInputs;