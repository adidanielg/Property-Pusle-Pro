// PropertyPulse — app.js
// Utilidades globales: loading states, fetch con auth check, offline state

// ── Interceptor global de fetch ───────────────────────────────
// Detecta 401 (sesión expirada) en cualquier llamada y redirige
const _originalFetch = window.fetch;
window.fetch = async function(...args) {
    const res = await _originalFetch(...args);
    if (res.status === 401) {
        try {
            const clone = res.clone();
            const data  = await clone.json();
            if (data.error === 'session_expired') {
                const role = document.body.getAttribute('data-user-role');
                const url  = role === 'tecnico' ? '/auth/login-tecnico?expired=1' : '/auth/login?expired=1';
                window.location.href = url;
                return res;
            }
        } catch (_) {}
    }
    return res;
};

// ── Loading button helper ─────────────────────────────────────
// Uso: const done = btnLoading(btn, 'Guardando...')
//      ... await fetch(...)
//      done()
function btnLoading(btn, text = 'Cargando...') {
    const original = btn.innerHTML;
    btn.disabled   = true;
    btn.innerHTML  = `<span style="opacity:.7">${text}</span>`;
    return () => {
        btn.disabled  = false;
        btn.innerHTML = original;
    };
}

// ── Toast notifications ───────────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.querySelector('.pp-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'pp-toast';
    toast.style.cssText = `
        position:fixed; bottom:1.5rem; right:1.5rem;
        padding:.85rem 1.25rem; border-radius:10px;
        font-size:.875rem; font-weight:500;
        box-shadow:0 8px 40px rgba(0,0,0,.2);
        z-index:9999; animation:toastIn .25s ease;
        max-width:320px; display:flex; align-items:center; gap:.5rem;
        ${type === 'success'
            ? 'background:var(--green);color:#fff;'
            : type === 'error'
            ? 'background:var(--red);color:#fff;'
            : 'background:var(--text-1);color:var(--bg);'
        }
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = '0', 3200);
    setTimeout(() => toast.remove(), 3500);
}

// ── Offline / Online state ────────────────────────────────────
function createOfflineBanner() {
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.style.cssText = `
        display:none; position:fixed; top:0; left:0; right:0;
        background:#f59e0b; color:#fff;
        padding:.6rem 1rem; text-align:center;
        font-size:.875rem; font-weight:500;
        z-index:99999;
    `;
    banner.innerHTML = '📡 Sin conexión — algunos cambios pueden no guardarse';
    document.body.appendChild(banner);
    return banner;
}

function initOfflineState() {
    const banner = createOfflineBanner();

    window.addEventListener('offline', () => {
        banner.style.display = 'block';
        showToast('📡 Sin conexión a internet', 'error');
    });

    window.addEventListener('online', () => {
        banner.style.display = 'none';
        showToast('✅ Conexión restaurada', 'success');
    });

    // Si arranca offline
    if (!navigator.onLine) banner.style.display = 'block';
}

// ── Confirmar acciones destructivas ──────────────────────────
// Uso: if (!await confirmAction('¿Eliminar propiedad?')) return;
function confirmAction(message, dangerLabel = 'Confirmar', cancelLabel = 'Cancelar') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:fixed; inset:0; background:rgba(0,0,0,.5);
            backdrop-filter:blur(4px); z-index:10000;
            display:flex; align-items:center; justify-content:center; padding:1rem;
        `;

        overlay.innerHTML = `
            <div style="background:var(--surface);border:1px solid var(--border);
                border-radius:16px;padding:2rem;max-width:400px;width:100%;
                box-shadow:0 20px 60px rgba(0,0,0,.3);">
                <p style="font-size:1rem;font-weight:600;margin-bottom:.5rem">⚠️ Confirmar acción</p>
                <p style="font-size:.9rem;color:var(--text-2);margin-bottom:1.5rem">${message}</p>
                <div style="display:flex;gap:.75rem;justify-content:flex-end">
                    <button id="cc-cancel" style="background:var(--surface-2);border:1px solid var(--border);
                        color:var(--text-1);padding:.5rem 1.25rem;border-radius:8px;cursor:pointer;font-size:.875rem">
                        ${cancelLabel}
                    </button>
                    <button id="cc-confirm" style="background:var(--red);color:#fff;border:none;
                        padding:.5rem 1.25rem;border-radius:8px;cursor:pointer;font-size:.875rem;font-weight:500">
                        ${dangerLabel}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.querySelector('#cc-cancel').onclick  = () => { overlay.remove(); resolve(false); };
        overlay.querySelector('#cc-confirm').onclick = () => { overlay.remove(); resolve(true);  };
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initOfflineState();
});

// Exportar globalmente
window.btnLoading    = btnLoading;
window.showToast     = showToast;
window.confirmAction = confirmAction;