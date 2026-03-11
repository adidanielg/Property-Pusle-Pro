require('dotenv').config();

const express      = require('express');
const path         = require('path');
const cookieParser = require('cookie-parser');

const authRoutes         = require('./routes/authRoutes');
const clientRoutes       = require('./routes/clientRoutes');
const techRoutes         = require('./routes/techRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
app.set('trust proxy', 1);

// ── Motor de vistas ───────────────────────────────────────────
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.set('views', path.join(__dirname, 'views', 'pages'));

// ── Middlewares ───────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Rutas ─────────────────────────────────────────────────────
app.get('/', (req, res) => res.render('index.html'));
app.use('/auth',           authRoutes);
app.use('/cliente',        clientRoutes);
app.use('/tecnico',        techRoutes);
app.use('/admin',          adminRoutes);
app.use('/notificaciones', notificationRoutes);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).render('404.html'));

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Servidor local ────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`\n🚀  http://localhost:${PORT}\n`));
}

module.exports = app;