// PropertyPulse — theme.js
// Dark mode permanente — el producto siempre usa dark mode

const theme = {
    init() {
        // Siempre dark
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('pp_theme', 'dark');
        // Sincronizar con servidor
        const userId   = document.body?.getAttribute('data-user-id');
        const userRole = document.body?.getAttribute('data-user-role');
        if (userId && userRole) {
            fetch('/auth/set-theme', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ theme: 'dark' })
            }).catch(() => {});
        }
    }
};

document.addEventListener('DOMContentLoaded', () => theme.init());
