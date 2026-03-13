# PropertyPulse — Notas y Pendientes

## ✅ COMPLETADO
- Auth completo (login, registro, JWT, roles)
- Dashboard cliente, técnico, admin
- Tickets con categorías (incluyendo Bajo voltaje/Cámaras y Handyman)
- Calificaciones de técnicos
- Push notifications (VAPID configurado)
- i18n ES/EN en todas las páginas
- Dark / light mode
- PWA — instalable en móvil (manifest + íconos)
- Perfil editable (cliente y técnico)
- Landing page de ventas (`/` y `/landing`)
- Onboarding modal (primer login)
- Cancelaciones con notificación push y log en admin
- Chat por ticket (polling cada 5s, temporal)
- Plan limits conectados (Starter / Pro / Business)
- `planLimits.js` con lógica de upgrades
- Rate limiting en todas las rutas (`middleware/rateLimiter.js`)
- Sanitización de inputs XSS (`middleware/sanitize.js`)
- Helmet.js — headers de seguridad HTTP (`server.js`)
- Validación de variables de entorno al arrancar (`middleware/validateEnv.js`)
- Manejo global de errores en Express (`middleware/errorHandler.js`)
- Compresión gzip (`compression` en `server.js`)
- Soft delete en propiedades y tickets (`migrations/soft_delete_and_indexes.sql`)
- Índices en DB — migración `soft_delete_and_indexes.sql`
- Terms of Service (`/terms`)
- Privacy Policy (`/privacy`)
- Botón "eliminar mi cuenta" — perfil cliente y técnico (CCPA)

---

## 🖥️ PENDIENTE — Se hace en código (podemos hacerlo ahora)

### 1. Validación de esquema en endpoints
- Rechazar JSON malformado o campos faltantes en todas las rutas
- Usar una librería como `joi` o validación manual
- Prioridad: media

### 2. Manejo graceful de sesión expirada
- Si el JWT vence a mitad de sesión → redirect limpio al login con mensaje
- Actualmente el usuario ve un error genérico
- Prioridad: media

### 3. Loading states en todos los fetch
- Mostrar spinner o deshabilitar botones mientras carga
- Evita que el usuario haga doble click y mande requests duplicados
- Prioridad: media

### 4. Confirmación antes de acciones destructivas
- Borrar propiedad, cancelar ticket — ya tiene confirm() básico
- Mejorar con modal de confirmación visual
- Prioridad: baja

### 5. Offline state en PWA
- Si se va internet → mostrar banner "Sin conexión" en lugar de pantalla blanca
- Ya tiene `sw.js` — solo agregar un listener de `online/offline`
- Prioridad: baja

### 6. Paginación en admin dashboard
- Con 500+ tickets la página carga lento
- Agregar paginación de 20 en 20
- Prioridad: baja (solo importa cuando haya volumen)

### 7. Optimización de imágenes de tickets
- Comprimir imágenes antes de subir a Supabase Storage
- Usar canvas o librería `browser-image-compression`
- Prioridad: baja

--------------------------------------------------------------------------------------------------------------------------------------

## 🔑 PENDIENTE — Requiere cuentas / servicios externos

### ANTES DE LANZAR (días antes de abrir al público)

#### Resend — Emails transaccionales
1. Crear cuenta en https://resend.com (gratis)
2. Copiar API key → agregar en Vercel: `RESEND_API_KEY=re_xxxxxx`
3. Instalar: `npm install resend`
4. Cuando tengas dominio propio: verificarlo en Resend dashboard

**Emails a implementar:**
- Bienvenida al registrarse (cliente y técnico)
- Verificación de email al registrarse
- Recuperar contraseña (link con token, expira en 1 hora)
- Notificación de ticket creado
- Notificación de cambio de estado
- Notificación de cancelación

**Nota:** Usar `onboarding@resend.dev` hasta tener dominio propio (3,000 emails/mes gratis).

---

#### Stripe — Cobros por suscripción
1. Crear cuenta en https://stripe.com
2. Crear 3 productos: Starter $9 / Pro $29 / Business $79
3. Copiar Price IDs → agregar en Vercel
4. Instalar: `npm install stripe`

**Variables de entorno:**
```
STRIPE_SECRET_KEY=sk_live_xxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxx
STRIPE_PRICE_STARTER=price_xxxxxx
STRIPE_PRICE_PRO=price_xxxxxx
STRIPE_PRICE_BUSINESS=price_xxxxxx
```

**Lo que hay que construir:**
- Página `/checkout?plan=pro` que lanza Stripe Checkout
- Webhook `/stripe/webhook` que actualiza columna `plan` en Supabase al pagar
- Portal de cliente Stripe para cancelar/cambiar plan
- Bloquear acceso si suscripción expiró

---

#### Google Maps
1. Obtener API key en https://console.cloud.google.com
2. En `dashboardCliente.html` buscar: `const GMAPS_KEY = ''`
3. Pegar tu key ahí

---

#### Sentry — Logging de errores en producción
1. Crear cuenta en https://sentry.io (gratis hasta 5k errores/mes)
2. Crear proyecto Node.js
3. Instalar: `npm install @sentry/node`
4. Agregar en Vercel: `SENTRY_DSN=https://xxxxxx@sentry.io/xxxxxx`
5. Agregar 3 líneas al inicio de `server.js`:
```javascript
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });
app.use(Sentry.Handlers.requestHandler());
```

---

#### UptimeRobot — Monitor de disponibilidad
1. Crear cuenta en https://uptimerobot.com (gratis)
2. Agregar monitor HTTP → tu URL de Vercel
3. Configurar alerta por email si la app cae
- Sin código, 100% externo, 5 minutos de setup

---

#### Backups automáticos de Supabase
- El plan free NO incluye backups automáticos
- Opciones:
  - Upgradear a Supabase Pro ($25/mes) → backups diarios automáticos
  - O hacer backup manual semanal: Supabase → Settings → Database → Backups
- Recomendación: esperar a tener ingresos antes de pagar Pro

---

## 📋 VARIABLES DE ENTORNO EN VERCEL
```
SUPABASE_URL=               ✅ configurado
SUPABASE_KEY=               ✅ configurado
SESSION_SECRET=             ✅ configurado
ADMIN_USERNAME=             ✅ configurado
ADMIN_PASSWORD=             ✅ configurado
VAPID_PUBLIC_KEY=BO6S5wAwnwxZqXJtfGBQniwzi2XKqkHvndoJodZrPzRMUUWV3Cc_YtIbmy3appADx55ldSAjW5lErYXABC_Fq5g
VAPID_PRIVATE_KEY=XitAxzz5OBry3pWFhdYlini8CqVCn2vAMSRi1cGqmXQ
RESEND_API_KEY=             ⏳ pendiente
SENTRY_DSN=                 ⏳ pendiente
STRIPE_SECRET_KEY=          ⏳ pendiente
STRIPE_WEBHOOK_SECRET=      ⏳ pendiente
STRIPE_PRICE_STARTER=       ⏳ pendiente
STRIPE_PRICE_PRO=           ⏳ pendiente
STRIPE_PRICE_BUSINESS=      ⏳ pendiente
GOOGLE_MAPS_KEY=            ⏳ pendiente
```

---

## 🗄️ MIGRACIONES SQL
```
migrations/add_lang.sql                 ⏳ ejecutar en Supabase
migrations/add_cancelaciones.sql        ⏳ ejecutar en Supabase
migrations/soft_delete_and_indexes.sql  ⏳ ejecutar en Supabase
```

---

## 💰 PROYECCIÓN
- 50 clientes Starter ($9) = $450/mes
- 200 clientes Pro ($29) = $5,800/mes
- 48 clientes Business ($79) = $3,792/mes
- **Total con 298 clientes = ~$10,042/mes**

---

## 📝 NOTAS VARIAS
- El chat por ticket usa polling (fetch cada 5s) — simple y funciona bien para el volumen inicial
- Los mensajes del chat NO se borran solos — limpiar con: `DELETE FROM ticket_mensajes WHERE created_at < now() - interval '30 days'`
- El onboarding modal usa localStorage — si el usuario limpia su browser, vuelve a aparecer (correcto)
- Dark mode se sincroniza con Supabase para usuarios logueados, localStorage para visitantes
- VAPID keys NO cambiar — si se regeneran, todos los usuarios pierden sus suscripciones push