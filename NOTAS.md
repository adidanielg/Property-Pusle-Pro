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

---

## ⏳ PENDIENTE

### 1. Resend — Emails transaccionales
**Qué hacer:**
1. Crear cuenta en https://resend.com (gratis)
2. Copiar API key → agregar en Vercel: `RESEND_API_KEY=re_xxxxxx`
3. Instalar: `npm install resend`
4. Cuando tengas dominio propio: verificarlo en Resend dashboard

**Emails a implementar:**
- Bienvenida al registrarse (cliente y técnico)
- Verificación de email al registrarse
- Recuperar contraseña (link con token)
- Notificación de ticket creado
- Notificación de cambio de estado
- Notificación de cancelación

**Nota:** Por ahora usar `onboarding@resend.dev` (gratis para siempre, 3,000 emails/mes).
Cuando tengas dominio propio cambiar a `noreply@tudominio.com`.

---

### 2. Stripe — Cobros por suscripción
**Qué hacer:**
1. Crear cuenta en https://stripe.com
2. Crear 3 productos en Stripe dashboard:
   - Starter: $9/mes
   - Pro: $29/mes
   - Business: $79/mes
3. Copiar Price IDs → agregar en Vercel
4. Instalar: `npm install stripe`
5. Agregar variables de entorno:
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

**Migración SQL ya lista** (columnas `plan`, `stripe_customer_id`, `stripe_subscription_id` en `companias`)

---

### 3. Google Maps
**Qué hacer:**
1. Obtener API key en https://console.cloud.google.com
2. En `dashboardCliente.html` buscar: `const GMAPS_KEY = ''`
3. Pegar tu key ahí

---

## 📋 VARIABLES DE ENTORNO EN VERCEL
```
SUPABASE_URL=
SUPABASE_KEY=
SESSION_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=
VAPID_PUBLIC_KEY=BO6S5wAwnwxZqXJtfGBQniwzi2XKqkHvndoJodZrPzRMUUWV3Cc_YtIbmy3appADx55ldSAjW5lErYXABC_Fq5g
VAPID_PRIVATE_KEY=XitAxzz5OBry3pWFhdYlini8CqVCn2vAMSRi1cGqmXQ
RESEND_API_KEY=          ← pendiente
STRIPE_SECRET_KEY=       ← pendiente
STRIPE_WEBHOOK_SECRET=   ← pendiente
STRIPE_PRICE_STARTER=    ← pendiente
STRIPE_PRICE_PRO=        ← pendiente
STRIPE_PRICE_BUSINESS=   ← pendiente
```

---

## 🗄️ MIGRACIONES SQL PENDIENTES DE EJECUTAR
```
migrations/add_lang.sql           ← lang + theme en companias y tecnicos
migrations/add_cancelaciones.sql  ← tabla cancelaciones + ticket_mensajes + estado cancelado
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
- Los mensajes del chat NO se borran solos — si quieres limpiarlos: `DELETE FROM ticket_mensajes WHERE created_at < now() - interval '30 days'`
- El onboarding modal usa localStorage — si un usuario limpia su browser, vuelve a aparecer (comportamiento correcto)
- Dark mode se sincroniza con Supabase para usuarios logueados, localStorage para visitantes

---

## 🏗️ ANÁLISIS DE ARQUITECTURA — Pendientes adicionales

### 🔴 CRÍTICO (antes de lanzar)

**Seguridad:**
- [ ] Rate limiting en TODAS las rutas (no solo login/registro)
- [ ] Sanitización de inputs contra XSS en todos los campos
- [ ] Helmet.js — headers de seguridad HTTP (CSP, HSTS, X-Frame-Options)
- [ ] Validación de variables de entorno al arrancar el servidor
- [ ] Tokens de reset de contraseña con expiración de 1 hora (cuando se implemente Resend)

**Errores y disponibilidad:**
- [ ] Manejo global de errores en Express (evitar crashes silenciosos)
- [ ] Logging en producción (saber qué falla en Vercel)
- [ ] Validación de esquema en todos los endpoints (rechazar JSON malformado)

---

### 🟡 IMPORTANTE (duele no tenerlo con clientes reales)

**Operaciones:**
- [ ] Backups automáticos de Supabase (plan free NO los incluye)
- [ ] Soft delete en propiedades y tickets (columna deleted_at, nunca DELETE real)
- [ ] Paginación en admin dashboard (500+ tickets = carga lenta)
- [ ] Índices en DB: compania_id, estado, created_at en tabla tickets

**Experiencia:**
- [ ] Manejo graceful de sesión expirada (JWT vencido = redirect limpio al login)
- [ ] Loading states en todos los fetch
- [ ] Confirmación antes de acciones destructivas (borrar propiedad, cancelar ticket)
- [ ] Offline state en PWA (mensaje claro si se va internet)

**Negocio / Legal:**
- [ ] Términos de servicio (ToS) — requerido por Stripe
- [ ] Privacy Policy — requerido por Apple/Google y CCPA
- [ ] Botón "eliminar mi cuenta y datos" — requerimiento legal en USA (CCPA)

---

### 🟢 NICE TO HAVE (para escalar)

**Monitoreo:**
- [ ] Sentry — captura errores en producción (gratis hasta 5k errores/mes)
- [ ] UptimeRobot — alerta si la app está caída (gratis)
- [ ] Analytics — Plausible o Posthog (saber de dónde vienen usuarios)

**Performance:**
- [ ] Compresión gzip en Express (middleware compression) — reduce payload 60-70%
- [ ] Cache en endpoints que no cambian frecuente (categorías, planes)
- [ ] Optimización de imágenes de tickets antes de guardar en Supabase Storage

**Arquitectura futura:**
- [ ] Webhooks para integraciones externas
- [ ] API pública documentada
- [ ] Multi-tenancy más robusto (auditar queries para evitar filtrado entre compañías)
- [ ] Job queue para emails y notificaciones (evitar pérdida si Resend falla)

---

### 📋 ORDEN DE PRIORIDAD PARA LANZAR
1. helmet + sanitización de inputs (~2h)
2. Manejo global de errores en Express (~30min)
3. Validación de variables de entorno al arrancar (~30min)
4. Soft delete en propiedades y tickets (~1h)
5. Índices en Supabase (~15min)
6. Sentry (~20min)
7. UptimeRobot (~5min)
8. Terms of Service y Privacy Policy (generar con IA)
9. Botón "eliminar mi cuenta" (~1h)
