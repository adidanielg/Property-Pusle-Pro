// ============================================================
// PropertyPulse — server.js
// Entry point de la aplicación
// ============================================================
require('dotenv').config();

const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');

// ── Rutas ────────────────────────────────────────────────────
const authRoutes   = require('./routes/authRoutes');
const clientRoutes = require('./routes/clientRoutes');
const techRoutes   = require('./routes/techRoutes');
const adminRoutes  = require('./routes/adminRoutes');

// ── App ──────────────────────────────────────────────────────
const app = express();

// ── Motor de vistas EJS ──────────────────────────────────────
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// ── Middlewares globales ─────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Rutas ────────────────────────────────────────────────────
app.get('/', (req, res) => res.render('pages/index.html'));

app.use('/auth',    authRoutes);
app.use('/cliente', clientRoutes);
app.use('/tecnico', techRoutes);
app.use('/admin',   adminRoutes);

// ── Error 404 ────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).send('<h2>404 — Página no encontrada</h2><a href="/">Volver al inicio</a>');
});

// ── Arranque local / exportación Vercel ─────────────────────
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n🚀 PropertyPulse corriendo en http://localhost:${PORT}\n`);
    });
}

module.exports = app;