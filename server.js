require('dotenv').config();

// ── Validar env vars ANTES de arrancar ───────────────────────
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
const stripeRoutes       = require('./routes/stripeRoutes');

const app = express();
app.set('trust proxy', 1);

// ── Webhook Stripe — PRIMERO, antes de cualquier middleware ───
// Stripe requiere el body RAW sin parsear para verificar la firma
const stripeService = require('./services/stripeService');
app.post('/webhook/stripe',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        const sig = req.headers['stripe-signature'];
        console.log('[WEBHOOK] Recibido evento de Stripe');
        console.log('[WEBHOOK] Signature presente:', !!sig);
        console.log('[WEBHOOK] Body size:', req.body?.length || 0);
        try {
            const event = stripeService.verifyWebhook(req.body, sig);
            console.log('[WEBHOOK] Evento verificado:', event.type);
            await stripeService.handleWebhookEvent(event);
            console.log('[WEBHOOK] ✅ Evento procesado:', event.type);
            res.json({ received: true });
        } catch (err) {
            console.error('[WEBHOOK] ❌ Error:', err.message);
            res.status(400).send(`Webhook Error: ${err.message}`);
        }
    }
);

// ── Seguridad — Helmet ────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://maps.googleapis.com", "https://js.stripe.com"],
            scriptSrcAttr:  ["'unsafe-inline'"],  // permite onclick= en elementos HTML
            styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
            fontSrc:        ["'self'", "https://fonts.gstatic.com"],
            imgSrc:         ["'self'", "data:", "blob:", "https://*.supabase.co", "https://maps.googleapis.com", "https://maps.gstatic.com"],
            connectSrc:     ["'self'", "https://*.supabase.co", "https://maps.googleapis.com", "https://api.stripe.com"],
            workerSrc:      ["'self'"],
            frameSrc:       ["https://js.stripe.com", "https://hooks.stripe.com"],
            manifestSrc:    ["'self'"],
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

// ── Archivos estáticos ANTES del rate limiter y auth ─────────
// Crítico: manifest.json, sw.js, íconos y JS/CSS deben ser públicos
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
    etag: true,
}));

// ── Rutas públicas que no necesitan auth ni rate limit ────────
app.get('/sw.js',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'sw.js')));
app.get('/manifest.json',(req, res) => res.sendFile(path.join(__dirname, 'public', 'manifest.json')));

// ── Sanitización global de inputs ────────────────────────────
app.use(sanitizeInputs);

// ── Rate limiting — solo en rutas de API/auth ─────────────────
app.use('/auth',           apiLimiter);
app.use('/cliente',        apiLimiter);
app.use('/tecnico',        apiLimiter);
app.use('/admin',          apiLimiter);
app.use('/notificaciones', apiLimiter);

// ── Rutas públicas ────────────────────────────────────────────
app.get('/',        (req, res) => res.render('landing', { title: 'PropertyPulse — Property Maintenance, Simplified' }));
app.get('/landing', (req, res) => res.render('landing', { title: 'PropertyPulse — Property Maintenance, Simplified' }));
app.get('/pricing', (req, res) => res.redirect('/#pricing'));
app.get('/app',     (req, res) => res.render('index',   { title: 'Acceder — PropertyPulse' }));
app.get('/inicio',  (req, res) => res.redirect('/app'));
app.get('/terms',    (req, res) => res.render('terms',    { title: 'Terms of Service — PropertyPulse' }));
app.get('/privacy',  (req, res) => res.render('privacy',  { title: 'Privacy Policy — PropertyPulse' }));
app.get('/tecnicos', (req, res) => res.render('tecnicos', { title: 'Técnicos — PropertyPulse' }));

// ── API pública — sin auth ─────────────────────────────────────
const supabasePub = require('./services/supabaseClient');

app.get('/pub/tecnicos', async (req, res) => {
    try {
        const { data: tecnicos } = await supabasePub
            .from('tecnicos')
            .select('id, nombre, especialidad, ocupado, trabajos_completados, activo')
            .eq('activo', true)
            .order('trabajos_completados', { ascending: false });

        const { data: calificaciones } = await supabasePub
            .from('calificaciones').select('tecnico_id, estrellas');

        const statsMap = {};
        (calificaciones || []).forEach(c => {
            if (!statsMap[c.tecnico_id]) statsMap[c.tecnico_id] = { suma: 0, total: 0 };
            statsMap[c.tecnico_id].suma  += c.estrellas;
            statsMap[c.tecnico_id].total += 1;
        });

        const result = (tecnicos || []).map(t => ({
            ...t,
            promedio:   statsMap[t.id] ? (statsMap[t.id].suma / statsMap[t.id].total).toFixed(1) : null,
            totalCalif: statsMap[t.id]?.total || 0
        })).sort((a, b) => {
            if (a.ocupado !== b.ocupado) return a.ocupado ? 1 : -1;
            return (parseFloat(b.promedio) || 0) - (parseFloat(a.promedio) || 0);
        });

        res.json({ success: true, tecnicos: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/pub/tecnicos/:id/resenas', async (req, res) => {
    try {
        const { data } = await supabasePub
            .from('calificaciones')
            .select('estrellas, comentario, created_at')
            .eq('tecnico_id', req.params.id)
            .order('created_at', { ascending: false })
            .limit(10);
        res.json({ success: true, resenas: data || [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Rutas de la app ───────────────────────────────────────────
app.use('/auth',           authRoutes);
app.use('/cliente',        clientRoutes);
app.use('/tecnico',        techRoutes);
app.use('/admin',          adminRoutes);
app.use('/notificaciones', notificationRoutes);
app.use('/stripe',         stripeRoutes);

// ── Manejo de errores ─────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Servidor local ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`\n🚀  http://localhost:${PORT}\n`));
}

module.exports = app;