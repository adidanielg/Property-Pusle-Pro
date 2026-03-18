// PropertyPulse — i18n.js
// Sistema de traducción ES/EN con localStorage + Supabase sync

const translations = {
    es: {
        // Nav / Sidebar
        'nav.dashboard':        'Panel',
        'nav.properties':       'Mis Propiedades',
        'nav.tickets':          'Mis Tickets',
        'nav.logout':           'Cerrar sesión',
        'nav.myJobs':           'Mis trabajos',

        // Landing
        'landing.tagline':      'Plataforma profesional de gestión de mantenimiento para propiedades.\nConecta clientes, técnicos y administradores en un solo lugar.',
        'landing.clientPortal': 'Portal de Clientes',
        'landing.clientDesc':   'Gestiona tus propiedades y reporta problemas de mantenimiento fácilmente.',
        'landing.techPortal':   'Portal de Técnicos',
        'landing.techDesc':     'Recibe trabajos de mantenimiento y gestiona tus servicios en campo.',
        'landing.login':        'Iniciar Sesión',
        'landing.register':     'Crear Cuenta',
        'landing.techLogin':    'Entrar al Panel',
        'landing.techRegister': 'Aplicar como Técnico',
        'landing.adminAccess':  '¿Eres administrador?',
        'landing.restricted':   'Acceso restringido →',
        'landing.howItWorks':   'Cómo funciona',
        'landing.pricing':      'Precios',
        'landing.faq':          'Preguntas',
        'landing.getStarted':   'Comenzar gratis →',
        'landing.getStarted2':  'Comenzar →',
        'landing.seeHow':       'Ver cómo funciona',
        'landing.startPro':     'Comenzar con Pro →',

        // Login
        'login.username':       'Usuario',
        'login.password':       'Contraseña',
        'login.enter':          'Ingresar',
        'login.noAccount':      '¿No tienes cuenta?',
        'login.register':       'Regístrate gratis',
        'login.areTech':        '¿Eres técnico?',
        'login.areClient':      '¿Eres cliente?',
        'login.enterHere':      'Ingresa aquí',
        'login.clientPortal':   'Portal de Clientes',
        'login.techPortal':     'Portal de Técnicos',
        'login.adminPortal':    'Acceso Administrativo',
        'login.adminUser':      'Usuario Maestro',
        'login.enterSystem':    'Ingresar al Sistema',

        // Register Cliente
        'reg.accountType':      'Tipo de cuenta',
        'reg.individual':       '👤 Individual',
        'reg.company':          '🏢 Compañía',
        'reg.companyName':      'Nombre de la Empresa',
        'reg.companyPlaceholder':'Ej. Inmobiliaria Sur S.A.',
        'reg.firstName':        'Nombre',
        'reg.lastName':         'Apellido',
        'reg.email':            'Email',
        'reg.phone':            'Teléfono',
        'reg.password':         'Contraseña',
        'reg.confirmPassword':  'Confirmar contraseña',
        'reg.createAccount':    'Crear mi cuenta',
        'reg.creating':         'Creando cuenta...',
        'reg.haveAccount':      '¿Ya tienes cuenta?',
        'reg.loginLink':        'Inicia sesión',
        'reg.successTitle':     '¡Cuenta creada!',
        'reg.successMsg':       'Guarda tu nombre de usuario para iniciar sesión:',
        'reg.successHint':      '📋 Cópialo — lo necesitarás para iniciar sesión',
        'reg.goLogin':          'Ir a iniciar sesión →',

        // Register Técnico
        'reg.specialty':        'Especialidad principal',
        'reg.selectSpecialty':  'Selecciona una especialidad...',
        'reg.register':         'Registrarme',
        'reg.processing':       'Procesando...',
        'reg.applyTech':        'Aplicar como técnico',
        'reg.successTechTitle': '¡Registro exitoso!',

        // Dashboard Cliente
        'dash.hello':           'Hola',
        'dash.clientSub':       'Gestiona tus propiedades y solicitudes de mantenimiento.',
        'dash.properties':      'Propiedades',
        'dash.openTickets':     'Tickets Abiertos',
        'dash.completed':       'Completados',
        'dash.addProperty':     '+ Agregar Propiedad',
        'dash.myProperties':    'Mis Propiedades',
        'dash.noProperties':    'No tienes propiedades registradas aún.',
        'dash.addFirst':        'Agrega tu primera propiedad para comenzar.',
        'dash.newTicket':       '+ Nuevo Ticket',
        'dash.myTickets':       'Mis Tickets',
        'dash.noTickets':       'No tienes tickets aún.',
        'dash.category':        'Categoría',
        'dash.reason':          'Motivo',
        'dash.description':     'Descripción',
        'dash.photo':           'Foto (opcional)',
        'dash.property':        'Propiedad',
        'dash.submit':          'Enviar Ticket',

        'nav.profile':            'Mi Perfil',
        'profile.title':          'Mi Perfil',
        'profile.passwordHint':   'Deja en blanco si no quieres cambiar tu contraseña',
        'profile.currentPassword':'Contraseña actual',
        'profile.newPassword':    'Nueva contraseña',
        'profile.save':           'Guardar cambios',
        'profile.saved':          '✅ Perfil actualizado correctamente',
        'dash.sending':         'Enviando...',
        'dash.plan':            'Tu Plan',
        'dash.editProfile':     '✏️ Editar perfil',
        'dash.changePassword':  '🔑 Cambiar contraseña',
        'dash.edit':            'Editar',
        'dash.delete':          'Eliminar',
        'dash.save':            'Guardar',
        'dash.cancel':          'Cancelar',
        'dash.address':         'Dirección',
        'dash.tech':            'Técnico',
        'dash.date':            'Fecha',
        'dash.rate':            '⭐ Calificar',
        'dash.rated':           '✅ Calificado',
        'dash.address':         'Dirección',
        'dash.services':        'Servicios contratados',
        'dash.edit':            'Editar',
        'dash.delete':          'Eliminar',
        'dash.save':            'Guardar',
        'dash.cancel':          'Cancelar',
        'dash.status':          'Estado',
        'dash.tech':            'Técnico',
        'dash.date':            'Fecha',

        // Dashboard Técnico
        'tech.hello':           'Hola',
        'tech.sub':             'Aquí están los trabajos disponibles y tus servicios en curso.',
        'tech.pending':         'Pendientes',
        'tech.inProgress':      'En proceso',
        'tech.completed':       'Completados',
        'tech.myRating':        'Mi calificación',
        'tech.noRatings':       'Sin calificaciones',
        'tech.availableJobs':   'Tickets disponibles y activos',
        'tech.noTickets':       '¡Buen trabajo! No hay tickets pendientes.',
        'tech.accept':          '✋ Aceptar trabajo',
        'tech.markDone':        '✅ Marcar completado',
        'tech.finished':        'Trabajo finalizado',
        'tech.myRatings':       '⭐ Mis calificaciones',
        'tech.average':         'Promedio',
        'tech.client':          'Cliente',
        'tech.directions':      '📍 Cómo llegar',


        // Admin extra
        'admin.subtitle':       'Métricas globales, gestión de clientes y técnicos.',
        'admin.individuals':    'Clientes Individuales',
        'admin.companies':      'Compañías',
        'admin.ticketsSystem':  'Tickets del Sistema',
        'admin.allCategories':  'Todas las categorías',
        'admin.allStatuses':    'Todos los estados',
        'admin.noTecnicos':     'No hay técnicos registrados.',
        'admin.noIndividuals':  'No hay clientes individuales.',
        'admin.noCompanies':    'No hay compañías registradas.',
        'admin.noTickets':      'No hay tickets registrados.',
        'admin.noReviews':      'Sin reseñas',
        'admin.active':         'Activo',
        'admin.inactive':       'Inactivo',
        'admin.unassigned':     'Sin asignar',
        'admin.editTech':       'Editar Técnico',
        'admin.editClient':     'Editar Cliente',
        'admin.saveChanges':    'Guardar cambios',
        'admin.deleteConfirm':  '¿Eliminar registro?',
        'admin.deleteWarning':  'Esta acción no se puede deshacer. Se eliminarán todos los datos asociados.',
        'admin.deleteConfirmBtn':'Sí, eliminar',
        'admin.col.name':       'Nombre',
        'admin.col.specialty':  'Especialidad',
        'admin.col.phone':      'Teléfono',
        'admin.col.rating':     'Calificación',
        'admin.col.status':     'Estado',
        'admin.col.actions':    'Acciones',
        'admin.col.user':       'Usuario',
        'admin.col.registered': 'Registro',
        'admin.col.company':    'Empresa',
        'admin.col.contact':    'Contacto',


        // Admin extra
        'admin.subtitle':       'Global metrics, client and technician management.',
        'admin.individuals':    'Individual Clients',
        'admin.companies':      'Companies',
        'admin.ticketsSystem':  'System Tickets',
        'admin.allCategories':  'All categories',
        'admin.allStatuses':    'All statuses',
        'admin.noTecnicos':     'No technicians registered.',
        'admin.noIndividuals':  'No individual clients.',
        'admin.noCompanies':    'No companies registered.',
        'admin.noTickets':      'No tickets registered.',
        'admin.noReviews':      'No reviews',
        'admin.active':         'Active',
        'admin.inactive':       'Inactive',
        'admin.unassigned':     'Unassigned',
        'admin.editTech':       'Edit Technician',
        'admin.editClient':     'Edit Client',
        'admin.saveChanges':    'Save changes',
        'admin.deleteConfirm':  'Delete record?',
        'admin.deleteWarning':  'This action cannot be undone. All associated data will be deleted.',
        'admin.deleteConfirmBtn':'Yes, delete',
        'admin.col.name':       'Name',
        'admin.col.specialty':  'Specialty',
        'admin.col.phone':      'Phone',
        'admin.col.rating':     'Rating',
        'admin.col.status':     'Status',
        'admin.col.actions':    'Actions',
        'admin.col.user':       'Username',
        'admin.col.registered': 'Registered',
        'admin.col.company':    'Company',
        'admin.col.contact':    'Contact',

        // Badges
        'badge.pending':        'Pendiente',
        'badge.inProgress':     'En proceso',
        'badge.completed':      'Completado',

        // Admin
        'admin.title':          'Panel de Administración',
        'admin.clients':        'Clientes',
        'admin.technicians':    'Técnicos',
        'admin.openTickets':    'Tickets Abiertos',
        'admin.resolved':       'Resueltos',
    },


        // Admin extra
        'admin.tecnicos':     'Técnicos',
        'admin.clientes':     'Clientes',
        'admin.ticketsOpen':  'Tickets abiertos',
        'admin.resolved':     'Resueltos',
        'admin.email':        'Email',
        'admin.availability': 'Disponibilidad',
        'admin.subscription': 'Suscripción',
        'admin.noProps':      'No ha agregado propiedades aún.',
        'admin.motivo':       'Motivo / Categoría',
        'admin.address':      'Dirección',
        'admin.contact':      'Contacto',

        // Status
        'status.pending':    'Pendiente',
        'status.inProgress': 'En proceso',
        'status.completed':  'Completado',
        'status.cancelled':  'Cancelado',
        'status.available':  'Disponible',
        'status.busy':       'Ocupado',

        // 404
        '404.title': 'Página no encontrada',
        '404.sub':   'La dirección que buscas no existe o fue movida. Verifica la URL o regresa al inicio.',
        '404.home':  'Ir al inicio',
        '404.back':  'Volver',

        // Recuperar usuario
        'rec.title': '¿Olvidaste tu usuario?',
        'rec.sub':   'Ingresa tu email y te enviamos tu nombre de usuario.',
        'rec.email': 'Email de tu cuenta',
        'rec.send':  'Enviar mi usuario →',
        'rec.back':  '← Volver al login',

        // Reset password
        'reset.title':   'Nueva contraseña',
        'reset.sub':     'Ingresa tu nueva contraseña.',
        'reset.new':     'Nueva contraseña',
        'reset.confirm': 'Confirmar contraseña',
        'reset.save':    'Guardar nueva contraseña →',
        'reset.goLogin': 'Ir al login →',

        // Modales login
        'modal.recUser':    'Recuperar usuario',
        'modal.recUserSub': 'Ingresa tu email y te enviamos tu nombre de usuario.',
        'modal.sendUser':   'Enviar mi usuario →',
        'modal.recPass':    'Recuperar contraseña',
        'modal.recPassSub': 'Ingresa tu email y usuario para recibir un link de reset.',
        'modal.sendReset':  'Enviar link de reset →',
        'modal.forgotUser': '¿Olvidaste tu usuario?',
        'modal.forgotPass': '¿Olvidaste tu contraseña?',

        // Tech dashboard
        'tech.myJobs':    'Mis trabajos',
        'tech.pending':   'Pendientes',
        'tech.inProgress':'En proceso',
        'tech.completed': 'Completados',
        'tech.noJobs':    'No hay trabajos asignados.',
        'tech.ratings':   'Mis calificaciones',
        'tech.noRatings': 'Sin calificaciones aún.',
        'tech.avgRating': 'Promedio',

        // Cliente dashboard
        'dash.plan':           'Tu Plan',
        'dash.editProfile':    'Editar perfil',
        'dash.changePassword': 'Cambiar contraseña',
        'dash.newTicket':      'Nuevo reporte',
    en: {
        // Nav / Sidebar
        'nav.dashboard':        'Dashboard',
        'nav.properties':       'My Properties',
        'nav.tickets':          'My Tickets',
        'nav.logout':           'Log out',
        'nav.myJobs':           'My Jobs',

        // Landing
        'landing.tagline':      'Professional property maintenance management platform.\nConnect clients, technicians and administrators in one place.',
        'landing.clientPortal': 'Client Portal',
        'landing.clientDesc':   'Manage your properties and report maintenance issues easily.',
        'landing.techPortal':   'Technician Portal',
        'landing.techDesc':     'Receive maintenance jobs and manage your field services.',
        'landing.login':        'Sign In',
        'landing.register':     'Create Account',
        'landing.techLogin':    'Enter Panel',
        'landing.techRegister': 'Apply as Technician',
        'landing.adminAccess':  'Are you an admin?',
        'landing.restricted':   'Restricted access →',
        'landing.howItWorks':   'How it works',
        'landing.pricing':      'Pricing',
        'landing.faq':          'FAQ',
        'landing.getStarted':   'Get started free →',
        'landing.getStarted2':  'Get started →',
        'landing.seeHow':       'See how it works',
        'landing.startPro':     'Start with Pro →',

        // Login
        'login.username':       'Username',
        'login.password':       'Password',
        'login.enter':          'Sign In',
        'login.noAccount':      "Don't have an account?",
        'login.register':       'Sign up free',
        'login.areTech':        'Are you a technician?',
        'login.areClient':      'Are you a client?',
        'login.enterHere':      'Sign in here',
        'login.clientPortal':   'Client Portal',
        'login.techPortal':     'Technician Portal',
        'login.adminPortal':    'Administrative Access',
        'login.adminUser':      'Master User',
        'login.enterSystem':    'Enter System',

        // Register Cliente
        'reg.accountType':      'Account type',
        'reg.individual':       '👤 Individual',
        'reg.company':          '🏢 Company',
        'reg.companyName':      'Company Name',
        'reg.companyPlaceholder':'E.g. South Real Estate Inc.',
        'reg.firstName':        'First Name',
        'reg.lastName':         'Last Name',
        'reg.email':            'Email',
        'reg.phone':            'Phone',
        'reg.password':         'Password',
        'reg.confirmPassword':  'Confirm password',
        'reg.createAccount':    'Create my account',
        'reg.creating':         'Creating account...',
        'reg.haveAccount':      'Already have an account?',
        'reg.loginLink':        'Sign in',
        'reg.successTitle':     'Account created!',
        'reg.successMsg':       'Save your username to sign in:',
        'reg.successHint':      '📋 Copy it — you will need it to sign in',
        'reg.goLogin':          'Go to sign in →',

        // Register Técnico
        'reg.specialty':        'Main specialty',
        'reg.selectSpecialty':  'Select a specialty...',
        'reg.register':         'Register',
        'reg.processing':       'Processing...',
        'reg.applyTech':        'Apply as technician',
        'reg.successTechTitle': 'Registration successful!',

        // Dashboard Cliente
        'dash.hello':           'Hello',
        'dash.clientSub':       'Manage your properties and maintenance requests.',
        'dash.properties':      'Properties',
        'dash.openTickets':     'Open Tickets',
        'dash.completed':       'Completed',
        'dash.addProperty':     '+ Add Property',
        'dash.myProperties':    'My Properties',
        'dash.noProperties':    'No properties registered yet.',
        'dash.addFirst':        'Add your first property to get started.',
        'dash.newTicket':       '+ New Ticket',
        'dash.myTickets':       'My Tickets',
        'dash.noTickets':       'No tickets yet.',
        'dash.category':        'Category',
        'dash.reason':          'Reason',
        'dash.description':     'Description',
        'dash.photo':           'Photo (optional)',
        'dash.property':        'Property',
        'dash.submit':          'Submit Ticket',

        'nav.profile':            'My Profile',
        'profile.title':          'My Profile',
        'profile.passwordHint':   'Leave blank if you don\'t want to change your password',
        'profile.currentPassword':'Current password',
        'profile.newPassword':    'New password',
        'profile.save':           'Save changes',
        'profile.saved':          '✅ Profile updated successfully',
        'dash.sending':         'Sending...',
        'dash.plan':            'Your Plan',
        'dash.editProfile':     '✏️ Edit profile',
        'dash.changePassword':  '🔑 Change password',
        'dash.edit':            'Edit',
        'dash.delete':          'Delete',
        'dash.save':            'Save',
        'dash.cancel':          'Cancel',
        'dash.address':         'Address',
        'dash.tech':            'Technician',
        'dash.date':            'Date',
        'dash.rate':            '⭐ Rate',
        'dash.rated':           '✅ Rated',
        'dash.address':         'Address',
        'dash.services':        'Contracted services',
        'dash.edit':            'Edit',
        'dash.delete':          'Delete',
        'dash.save':            'Save',
        'dash.cancel':          'Cancel',
        'dash.status':          'Status',
        'dash.tech':            'Technician',
        'dash.date':            'Date',

        // Dashboard Técnico
        'tech.hello':           'Hello',
        'tech.sub':             'Here are the available jobs and your active services.',
        'tech.pending':         'Pending',
        'tech.inProgress':      'In Progress',
        'tech.completed':       'Completed',
        'tech.myRating':        'My Rating',
        'tech.noRatings':       'No ratings yet',
        'tech.availableJobs':   'Available & active tickets',
        'tech.noTickets':       'Great job! No pending tickets.',
        'tech.accept':          '✋ Accept job',
        'tech.markDone':        '✅ Mark completed',
        'tech.finished':        'Job finished',
        'tech.myRatings':       '⭐ My Ratings',
        'tech.average':         'Average',
        'tech.client':          'Client',
        'tech.directions':      '📍 Get Directions',

        // Badges
        'badge.pending':        'Pending',
        'badge.inProgress':     'In Progress',
        'badge.completed':      'Completed',

        // Admin
        'admin.title':          'Administration Panel',
        'admin.clients':        'Clients',
        'admin.technicians':    'Technicians',
        'admin.openTickets':    'Open Tickets',
        'admin.resolved':       'Resolved',
    }
};

// ── Core i18n ─────────────────────────────────────────────────
const i18n = {
    lang: 'es',

    init() {
        // Cookie del servidor tiene prioridad (idioma guardado en Supabase)
        const cookie = document.cookie.split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('pp_lang='));
        const cookieLang = cookie ? cookie.split('=')[1] : null;

        // cookieLang > localStorage > 'es'
        this.lang = cookieLang || localStorage.getItem('pp_lang') || 'en';
        localStorage.setItem('pp_lang', this.lang);

        this.apply();
        this.renderToggle();
    },

    t(key) {
        return translations[this.lang][key] || translations['es'][key] || key;
    },

    apply() {
        // Traducir todos los elementos con data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const val = this.t(key);
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = val;
            } else if (el.tagName === 'OPTION') {
                el.textContent = val;
            } else {
                el.textContent = val;
            }
        });

        // Traducir placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = this.t(el.getAttribute('data-i18n-placeholder'));
        });

        // Actualizar html lang
        document.documentElement.lang = this.lang;
    },

    setLang(lang) {
        this.lang = lang;
        localStorage.setItem('pp_lang', lang);
        this.apply();
        this.updateToggleUI();

        // Sincronizar con Supabase si hay usuario logueado
        const userId = document.body.getAttribute('data-user-id');
        const userRole = document.body.getAttribute('data-user-role');
        if (userId && userRole) {
            fetch('/auth/set-lang', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lang })
            }).catch(() => {});
        }
    },

    renderToggle() {
        let w = document.getElementById('pp-lang-toggle');
        if (!w) {
            w = document.createElement('div');
            w.id = 'pp-lang-toggle';
            w.style.cssText = 'position:fixed;bottom:1.25rem;right:1.25rem;z-index:9999;display:flex;gap:.2rem;background:rgba(15,15,26,.92);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:.25rem;backdrop-filter:blur(8px);box-shadow:0 4px 16px rgba(0,0,0,.4)';
            document.body.appendChild(w);
        }
        w.innerHTML = '';
        ['es','en'].forEach(function(code) {
            var b = document.createElement('button');
            b.textContent = code.toUpperCase();
            b.setAttribute('data-lang', code);
            b.style.cssText = 'padding:.28rem .65rem;border:none;border-radius:6px;font-size:.74rem;font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit;';
            b.onclick = function() { i18n.setLang(code); };
            w.appendChild(b);
        });
        this.updateToggleUI();
    },

    _attachEvents() {
        // Adjuntar via addEventListener — sin onclick inline (respeta CSP strict)
        const esBtn = document.getElementById('lang-es');
        const enBtn = document.getElementById('lang-en');
        if (esBtn && !esBtn._i18nBound) {
            esBtn.addEventListener('click', () => i18n.setLang('es'));
            esBtn._i18nBound = true;
        }
        if (enBtn && !enBtn._i18nBound) {
            enBtn.addEventListener('click', () => i18n.setLang('en'));
            enBtn._i18nBound = true;
        }
    },

    updateToggleUI() {
        var w = document.getElementById('pp-lang-toggle');
        if (!w) return;
        var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c6dfa';
        w.querySelectorAll('button').forEach(function(b) {
            var active = b.getAttribute('data-lang') === i18n.lang;
            b.style.background = active ? accent : 'transparent';
            b.style.color = active ? '#fff' : 'rgba(255,255,255,.45)';
        });
    },
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => i18n.init());
} else {
    // DOM ya cargado (script al final del body)
    i18n.init();
}

// Re-aplicar traducciones en caso de navegación SPA o cambios dinámicos
window.addEventListener('load', () => {
    if (window.i18n) i18n.apply();
});