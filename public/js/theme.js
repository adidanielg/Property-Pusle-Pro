// PropertyPulse — theme.js
// Dark / Light mode con localStorage + sincronización Supabase

const theme = {
    current: 'light',

    init() {
        // Cookie del servidor tiene prioridad, luego localStorage, luego preferencia del OS
        const cookie = document.cookie.split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('pp_theme='));
        const cookieTheme = cookie ? cookie.split('=')[1] : null;

        const osPrefers = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

        this.current = cookieTheme || localStorage.getItem('pp_theme') || osPrefers;
        this.apply();
        this.renderToggle();
    },

    apply() {
        document.documentElement.setAttribute('data-theme', this.current);
        localStorage.setItem('pp_theme', this.current);
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = this.current === 'dark' ? '☀️' : '🌙';
    },

    toggle() {
        this.current = this.current === 'dark' ? 'light' : 'dark';
        this.apply();

        // Sincronizar con Supabase si hay usuario logueado
        const userId   = document.body.getAttribute('data-user-id');
        const userRole = document.body.getAttribute('data-user-role');
        if (userId && userRole) {
            fetch('/auth/set-theme', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ theme: this.current })
            }).catch(() => {});
        }
    },

    renderToggle() {
        if (document.getElementById('theme-toggle')) return;
        const btn = document.createElement('button');
        btn.id = 'theme-toggle';
        btn.title = 'Cambiar tema';
        btn.textContent = this.current === 'dark' ? '☀️' : '🌙';
        btn.onclick = () => theme.toggle();
        document.body.appendChild(btn);
    }
};

document.addEventListener('DOMContentLoaded', () => theme.init());