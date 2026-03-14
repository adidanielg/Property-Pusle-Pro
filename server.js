require('dotenv').config();

const validateEnv = require('./middleware/validateEnv');
validateEnv();

const express      = require('express');
const path         = require('path');
const ejs          = require('ejs');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const compression  = require('compression');

const sanitizeInputs            = require('./middleware/sanitize');
const { apiLimiter }            = require('./middleware/rateLimiter');
const { notFound, errorHandler} = require('./middleware/errorHandler');

const authRoutes         = require('./routes/authRoutes');
const clientRoutes       = require('./routes/clientRoutes');
const techRoutes         = require('./routes/techRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
app.set('trust proxy', 1);

// ── Archivos estáticos PRIMERO — antes de todo middleware ─────
// Crítico: manifest.json, sw.js, CSS, JS deben ser públicos sin auth
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    index: false,
}));

// Rutas explícitas para archivos PWA críticos
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(publicPath, 'manifest.json'));
});
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(publicPath, 'sw.js'));
});

// ── Helmet CSP ────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://maps.googleapis.com"],
            // unsafe-hashes permite onclick= onchange= onsubmit= en HTML
            scriptSrcAttr:  ["'unsafe-inline'"],
            styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
            fontSrc:        ["'self'", "https://fonts.gstatic.com"],
            imgSrc:         ["'self'", "data:", "blob:", "https://*.supabase.co", "https://maps.googleapis.com", "https://maps.gstatic.com"],
            connectSrc:     ["'self'", "https://*.supabase.co", "https://maps.googleapis.com"],
            workerSrc:      ["'self'"],
            manifestSrc:    ["'self'"],
            mediaSrc:       ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// ── Performance ───────────────────────────────────────────────
app.use(compression());

// ── Motor de vistas ───────────────────────────────────────────
const viewsRoot = path.join(__dirname, 'views');
app.engine('html', (filePath, options, callback) => {
    ejs.renderFile(filePath, options, { root: viewsRoot }, callback);
});
app.set('view engine', 'html');
app.set('views', path.join(viewsRoot, 'pages'));

// ── Middlewares base ──────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitizeInputs);

// ── Rate limiting — solo rutas de la app ──────────────────────
app.use('/auth',           apiLimiter);
app.use('/cliente',        apiLimiter);
app.use('/tecnico',        apiLimiter);
app.use('/admin',          apiLimiter);
app.use('/notificaciones', apiLimiter);

// ── Rutas públicas ────────────────────────────────────────────
app.get('/',        (req, res) => res.render('landing',  { title: 'PropertyPulse — Property Maintenance, Simplified' }));
app.get('/landing', (req, res) => res.render('landing',  { title: 'PropertyPulse — Property Maintenance, Simplified' }));
app.get('/pricing', (req, res) => res.redirect('/#pricing'));
app.get('/app',     (req, res) => res.render('index',    { title: 'Acceder — PropertyPulse' }));
app.get('/inicio',  (req, res) => res.redirect('/app'));
app.get('/terms',   (req, res) => res.render('terms',    { title: 'Terms of Service — PropertyPulse' }));
app.get('/privacy', (req, res) => res.render('privacy',  { title: 'Privacy Policy — PropertyPulse' }));

// ── Rutas de la app ───────────────────────────────────────────
app.use('/auth',           authRoutes);
app.use('/cliente',        clientRoutes);
app.use('/tecnico',        techRoutes);
app.use('/admin',          adminRoutes);
app.use('/notificaciones', notificationRoutes);

// ── Manejo de errores ─────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Servidor local ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`\n🚀  http://localhost:${PORT}\n`));
}

module.exports = app;
