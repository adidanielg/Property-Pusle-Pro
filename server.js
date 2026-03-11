require('dotenv').config();

const express     = require('express');
const path        = require('path');
const cookieParser = require('cookie-parser');

const authRoutes         = require('./routes/authRoutes');
const clientRoutes       = require('./routes/clientRoutes');
const techRoutes         = require('./routes/techRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// ── Motor de vistas ───────────────────────────────────────────
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

// ── Middlewares ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Rutas ─────────────────────────────────────────────────────
app.get('/', (req, res) => res.render('pages/index.html'));

app.use('/auth',           authRoutes);
app.use('/cliente',        clientRoutes);
app.use('/tecnico',        techRoutes);
app.use('/admin',          adminRoutes);
app.use('/notificaciones', notificationRoutes);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render('pages/404.html');
});

// ── Servidor local (no en Vercel) ─────────────────────────────
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`\n🚀  http://localhost:${PORT}\n`));
}

module.exports = app;