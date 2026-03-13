// ── Manejo global de errores ──────────────────────────────────

function notFound(req, res, next) {
    res.status(404).render('404.html');
}

function errorHandler(err, req, res, next) {
    const status = err.status || err.statusCode || 500;

    // Log completo en consola (visible en Vercel logs)
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    console.error(`Status: ${status} — ${err.message}`);
    if (status === 500) console.error(err.stack);

    // Respuesta al cliente — nunca exponer stack en producción
    if (req.accepts('json') || req.path.startsWith('/cliente') ||
        req.path.startsWith('/tecnico') || req.path.startsWith('/admin') ||
        req.path.startsWith('/auth') || req.path.startsWith('/notificaciones')) {
        return res.status(status).json({
            error: status === 500 ? 'Error interno del servidor' : err.message
        });
    }

    res.status(status).render('404.html');
}

// Captura de promesas no manejadas — evita crash del proceso
process.on('unhandledRejection', (reason) => {
    console.error('[UnhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[UncaughtException]', err);
    // En Vercel no se reinicia, pero en local sí
    if (process.env.NODE_ENV !== 'production') process.exit(1);
});

module.exports = { notFound, errorHandler };