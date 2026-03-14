// PropertyPulse — theme.js v2
// Dark / Light mode con localStorage + sincronización Supabase
// Funciona en TODAS las páginas: dashboards (botón en sidebar) y páginas sueltas (botón flotante)

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

        // Escuchar cambios del OS en tiempo real (para páginas sin sesión)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('pp_theme') && !cookieTheme) {
                this.current = e.matches ? 'dark' : 'light';
                this.apply();
            }
        });
    },

    apply() {
        document.documentElement.setAttribute('data-theme', this.current);
        localStorage.setItem('pp_theme', this.current);
        // Actualizar todos los botones de toggle que existan
        document.querySelectorAll('.pp-theme-btn, #theme-toggle, #topbar-theme-btn').forEach(btn => {
            btn.textContent = this.current === 'dark' ? '☀️' : '🌙';
            btn.title = this.current === 'dark' ? 'Modo claro' : 'Modo oscuro';
        });
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
        // Si ya existe algún botón de toggle, no crear más
        if (document.getElementById('theme-toggle') || document.getElementById('topbar-theme-btn') || document.querySelector('.pp-theme-btn')) return;

        // Detectar si estamos en un dashboard (tiene sidebar)
        const hasSidebar = document.querySelector('.sidebar-footer') !== null;

        if (hasSidebar) {
            // En dashboards: insertar botón en el sidebar footer
            const sidebarFooter = document.querySelector('.sidebar-footer');
            if (sidebarFooter) {
                const btn = document.createElement('button');
                btn.className = 'sidebar-theme-btn pp-theme-btn';
                btn.onclick = () => theme.toggle();
                btn.innerHTML = `<span class="icon">${this.current === 'dark' ? '☀️' : '🌙'}</span>
                    <span>${this.current === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>`;
                // Insertar antes del botón de logout
                const logoutBtn = sidebarFooter.querySelector('a[href="/auth/logout"]');
                if (logoutBtn) {
                    sidebarFooter.insertBefore(btn, logoutBtn);
                } else {
                    sidebarFooter.appendChild(btn);
                }
                return;
            }
        }

        // En páginas sin sidebar: botón flotante estándar
        const btn = document.createElement('button');
        btn.id = 'theme-toggle';
        btn.className = 'pp-theme-btn';
        btn.title = this.current === 'dark' ? 'Modo claro' : 'Modo oscuro';
        btn.textContent = this.current === 'dark' ? '☀️' : '🌙';
        btn.onclick = () => theme.toggle();
        document.body.appendChild(btn);
    }
};

document.addEventListener('DOMContentLoaded', () => theme.init());
window.toggleTheme = () => theme.toggle();
