// PropertyPulse — emailService.js
// Emails transaccionales con Resend

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Remitente — usar dominio verificado o el de prueba de Resend
const FROM = process.env.EMAIL_FROM || 'PropertyPulse <onboarding@resend.dev>';
const APP_URL = process.env.BASE_URL || 'https://www.getpropertypulse.net';

const emailService = {

    // ── 1. Bienvenida al registrarse ─────────────────────────
    async enviarBienvenida({ nombre, email, username, role }) {
        const isCliente = role !== 'tecnico';
        const loginUrl  = isCliente ? `${APP_URL}/auth/login` : `${APP_URL}/auth/login-tecnico`;
        const dashUrl   = isCliente ? `${APP_URL}/cliente/dashboard` : `${APP_URL}/tecnico/dashboard`;

        console.log(`[EMAIL] Enviando bienvenida a ${email} | FROM: ${FROM} | KEY: ${process.env.RESEND_API_KEY?.slice(0,8)}...`);

        try {
            const result = await resend.emails.send({
                from:    FROM,
                to:      email,
                subject: `¡Bienvenido a PropertyPulse, ${nombre}! 🏢`,
                html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#08080f;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">

  <!-- Logo -->
  <div style="text-align:center;margin-bottom:32px">
    <span style="font-size:1.4rem;font-weight:800;color:#f0f0f8">
      🏢 Property<span style="color:#7c6dfa">Pulse</span>
    </span>
  </div>

  <!-- Card -->
  <div style="background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:36px">
    <h1 style="color:#f0f0f8;font-size:1.4rem;font-weight:700;margin:0 0 8px">
      ¡Bienvenido, ${nombre}! 👋
    </h1>
    <p style="color:#8888aa;font-size:.95rem;line-height:1.6;margin:0 0 24px">
      Tu cuenta ${isCliente ? 'de cliente' : 'de técnico'} en PropertyPulse ha sido creada exitosamente.
    </p>

    <!-- Username box -->
    <div style="background:#15152a;border:1px solid rgba(124,109,250,.3);border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="color:#8888aa;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px">Tu nombre de usuario</p>
      <p style="color:#7c6dfa;font-size:1.4rem;font-weight:700;font-family:monospace;margin:0">${username}</p>
      <p style="color:#55557a;font-size:.78rem;margin:6px 0 0">⚠️ Guárdalo — lo necesitas para iniciar sesión</p>
    </div>

    ${isCliente ? `
    <!-- Plan info -->
    <div style="background:#15152a;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="color:#8888aa;font-size:.85rem;margin:0 0 4px">Para empezar a gestionar tus propiedades:</p>
      <p style="color:#f0f0f8;font-size:.85rem;margin:0">1. Inicia sesión con tu usuario<br>2. Agrega tu primera propiedad<br>3. Elige un plan — Starter tiene <strong style="color:#22d3a0">10 días gratis</strong></p>
    </div>
    ` : `
    <!-- Tech info -->
    <div style="background:#15152a;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="color:#8888aa;font-size:.85rem;margin:0 0 4px">Como técnico podrás:</p>
      <p style="color:#f0f0f8;font-size:.85rem;margin:0">✓ Recibir trabajos asignados<br>✓ Chatear con clientes<br>✓ Construir tu reputación con calificaciones</p>
    </div>
    `}

    <!-- CTA Button -->
    <a href="${dashUrl}" style="display:block;background:#7c6dfa;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:.95rem;margin-bottom:20px">
      Ir a mi dashboard →
    </a>

    <p style="color:#55557a;font-size:.78rem;text-align:center;margin:0">
      ¿Preguntas? Escríbenos a <a href="mailto:support@propertypulse.app" style="color:#7c6dfa">support@propertypulse.app</a>
    </p>
  </div>

  <!-- Footer -->
  <p style="color:#55557a;font-size:.75rem;text-align:center;margin-top:24px">
    © 2026 PropertyPulse · <a href="${APP_URL}/terms" style="color:#55557a">Términos</a> · <a href="${APP_URL}/privacy" style="color:#55557a">Privacidad</a>
  </p>
</div>
</body>
</html>`
            });
            console.log(`[EMAIL] Bienvenida enviada a ${email} | ID: ${result?.data?.id} | Error: ${result?.error?.message}`);
        } catch (err) {
            console.error('[EMAIL] Error bienvenida:', err.message);
        }
    },

    // ── 2. Recuperación de username ───────────────────────────
    async enviarRecuperacionUsername({ nombre, email, username, role }) {
        const loginUrl = role === 'tecnico'
            ? `${APP_URL}/auth/login-tecnico`
            : `${APP_URL}/auth/login`;

        try {
            await resend.emails.send({
                from:    FROM,
                to:      email,
                subject: 'Tu nombre de usuario en PropertyPulse 🔑',
                html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#08080f;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
  <div style="text-align:center;margin-bottom:32px">
    <span style="font-size:1.4rem;font-weight:800;color:#f0f0f8">🏢 Property<span style="color:#7c6dfa">Pulse</span></span>
  </div>
  <div style="background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:36px">
    <h1 style="color:#f0f0f8;font-size:1.3rem;font-weight:700;margin:0 0 8px">Recuperación de usuario 🔑</h1>
    <p style="color:#8888aa;font-size:.95rem;line-height:1.6;margin:0 0 24px">
      Hola ${nombre}, recibimos una solicitud para recuperar tu nombre de usuario.
    </p>
    <div style="background:#15152a;border:1px solid rgba(124,109,250,.3);border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="color:#8888aa;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;margin:0 0 6px">Tu nombre de usuario es</p>
      <p style="color:#7c6dfa;font-size:1.4rem;font-weight:700;font-family:monospace;margin:0">${username}</p>
    </div>
    <a href="${loginUrl}" style="display:block;background:#7c6dfa;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:.95rem;margin-bottom:20px">
      Iniciar sesión →
    </a>
    <p style="color:#55557a;font-size:.78rem;text-align:center;margin:0">
      Si no solicitaste esto, ignora este email.
    </p>
  </div>
  <p style="color:#55557a;font-size:.75rem;text-align:center;margin-top:24px">
    © 2026 PropertyPulse
  </p>
</div>
</body>
</html>`
            });
            console.log(`[EMAIL] Recuperación username enviada a ${email}`);
        } catch (err) {
            console.error('[EMAIL] Error recuperación:', err.message);
        }
    },

    // ── 3. Confirmación de pago / plan activado ───────────────
    async enviarConfirmacionPlan({ nombre, email, plan, proximaFactura }) {
        const planes = {
            starter:  { nombre: 'Starter', precio: '$9/mes', color: '#7c6dfa' },
            pro:      { nombre: 'Pro',     precio: '$29/mes', color: '#7c6dfa' },
            business: { nombre: 'Business',precio: '$79/mes', color: '#22d3a0' }
        };
        const planInfo = planes[plan] || planes.starter;
        const isStarter = plan === 'starter';

        try {
            await resend.emails.send({
                from:    FROM,
                to:      email,
                subject: `✅ Plan ${planInfo.nombre} activado — PropertyPulse`,
                html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#08080f;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
  <div style="text-align:center;margin-bottom:32px">
    <span style="font-size:1.4rem;font-weight:800;color:#f0f0f8">🏢 Property<span style="color:#7c6dfa">Pulse</span></span>
  </div>
  <div style="background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:36px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:2.5rem">🎉</div>
      <h1 style="color:#f0f0f8;font-size:1.3rem;font-weight:700;margin:8px 0">¡Plan activado!</h1>
      <p style="color:#8888aa;font-size:.9rem;margin:0">Hola ${nombre}, tu suscripción está activa.</p>
    </div>
    <div style="background:#15152a;border:1px solid rgba(124,109,250,.3);border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">
      <p style="color:#8888aa;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px">Plan activo</p>
      <p style="color:${planInfo.color};font-size:1.8rem;font-weight:800;margin:0 0 4px">${planInfo.nombre}</p>
      <p style="color:#f0f0f8;font-size:.95rem;margin:0">${planInfo.precio}</p>
      ${isStarter ? '<p style="color:#22d3a0;font-size:.82rem;margin:8px 0 0">✨ 10 días de prueba gratis incluidos</p>' : ''}
    </div>
    ${proximaFactura ? `<p style="color:#8888aa;font-size:.82rem;text-align:center;margin:0 0 20px">Próxima factura: <strong style="color:#f0f0f8">${proximaFactura}</strong></p>` : ''}
    <a href="${APP_URL}/cliente/dashboard" style="display:block;background:#7c6dfa;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:.95rem;margin-bottom:20px">
      Ir a mi dashboard →
    </a>
    <p style="color:#55557a;font-size:.78rem;text-align:center;margin:0">
      Puedes gestionar tu suscripción desde tu perfil en el dashboard.
    </p>
  </div>
  <p style="color:#55557a;font-size:.75rem;text-align:center;margin-top:24px">© 2026 PropertyPulse</p>
</div>
</body>
</html>`
            });
            console.log(`[EMAIL] Confirmación plan ${plan} enviada a ${email}`);
        } catch (err) {
            console.error('[EMAIL] Error confirmación plan:', err.message);
        }
    },

    // ── 4. Notificación de ticket al técnico ──────────────────
    async notificarTicketATecnico({ tecnicoNombre, tecnicoEmail, motivo, categoria, direccion, clienteNombre }) {
        try {
            await resend.emails.send({
                from:    FROM,
                to:      tecnicoEmail,
                subject: `🔧 Nuevo trabajo disponible — ${motivo}`,
                html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#08080f;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
  <div style="text-align:center;margin-bottom:32px">
    <span style="font-size:1.4rem;font-weight:800;color:#f0f0f8">🏢 Property<span style="color:#7c6dfa">Pulse</span></span>
  </div>
  <div style="background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:36px">
    <h1 style="color:#f0f0f8;font-size:1.3rem;font-weight:700;margin:0 0 8px">🔧 Nuevo trabajo disponible</h1>
    <p style="color:#8888aa;font-size:.9rem;margin:0 0 24px">Hola ${tecnicoNombre}, hay un nuevo ticket que puedes aceptar.</p>
    <div style="background:#15152a;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:20px;margin-bottom:24px">
      <div style="margin-bottom:12px">
        <p style="color:#55557a;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;margin:0 0 3px">Problema</p>
        <p style="color:#f0f0f8;font-size:.95rem;font-weight:600;margin:0">${motivo}</p>
      </div>
      ${categoria ? `
      <div style="margin-bottom:12px">
        <p style="color:#55557a;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;margin:0 0 3px">Categoría</p>
        <p style="color:#7c6dfa;font-size:.85rem;margin:0">${categoria}</p>
      </div>` : ''}
      <div style="margin-bottom:12px">
        <p style="color:#55557a;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;margin:0 0 3px">Dirección</p>
        <p style="color:#f0f0f8;font-size:.85rem;margin:0">📍 ${direccion}</p>
      </div>
      <div>
        <p style="color:#55557a;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;margin:0 0 3px">Cliente</p>
        <p style="color:#f0f0f8;font-size:.85rem;margin:0">👤 ${clienteNombre}</p>
      </div>
    </div>
    <a href="${APP_URL}/tecnico/dashboard" style="display:block;background:#22d3a0;color:#0a0a0f;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:.95rem;margin-bottom:20px">
      Ver trabajo y aceptar →
    </a>
    <p style="color:#55557a;font-size:.78rem;text-align:center;margin:0">
      Entra al dashboard para aceptar el trabajo antes que otro técnico.
    </p>
  </div>
  <p style="color:#55557a;font-size:.75rem;text-align:center;margin-top:24px">© 2026 PropertyPulse</p>
</div>
</body>
</html>`
            });
            console.log(`[EMAIL] Ticket notificado al técnico ${tecnicoEmail}`);
        } catch (err) {
            console.error('[EMAIL] Error notificación técnico:', err.message);
        }
    },


    // ── 6. Cotización al cliente ──────────────────────────────
    async enviarCotizacion({ clienteNombre, clienteEmail, tecnicoNombre, motivo, precio, descripcion, cotizacionId }) {
        try {
            const dashUrl = `${APP_URL}/cliente/dashboard`;
            await resend.emails.send({
                from:    FROM,
                to:      clienteEmail,
                subject: `💰 Nueva cotización para: ${motivo} — PropertyPulse`,
                html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#08071a;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
  <div style="text-align:center;margin-bottom:28px">
    <span style="font-size:1.4rem;font-weight:800;color:#fff">Property<span style="color:#7c6dfa">Pulse</span></span>
  </div>
  <div style="background:#0f0d2a;border:1px solid #2a2560;border-radius:16px;padding:32px">
    <div style="font-size:2rem;margin-bottom:8px">💰</div>
    <h1 style="color:#eeeeff;font-size:1.3rem;font-weight:700;margin:0 0 8px">Nueva cotización recibida</h1>
    <p style="color:#9490c8;font-size:.9rem;margin:0 0 24px">Hola ${clienteNombre}, ${tecnicoNombre} envió una cotización para tu solicitud.</p>

    <div style="background:#16133a;border:1px solid #2a2560;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:.75rem;color:#9490c8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Solicitud</div>
      <div style="color:#eeeeff;font-weight:600;margin-bottom:16px">${motivo}</div>
      <div style="font-size:.75rem;color:#9490c8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Técnico</div>
      <div style="color:#eeeeff;font-weight:600;margin-bottom:16px">${tecnicoNombre}</div>
      <div style="font-size:.75rem;color:#9490c8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Descripción del trabajo</div>
      <div style="color:#9490c8;font-size:.875rem;margin-bottom:16px">${descripcion}</div>
      <div style="font-size:.75rem;color:#9490c8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Precio cotizado</div>
      <div style="color:#7c6dfa;font-size:1.8rem;font-weight:800">$${precio.toFixed(2)}</div>
    </div>

    <a href="${dashUrl}" style="display:block;background:#7c6dfa;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:700;font-size:.95rem;margin-bottom:12px">
      Ver cotización en mi panel →
    </a>
    <p style="color:#55557a;font-size:.78rem;text-align:center;margin:0">Tienes 48 horas para aprobar o rechazar esta cotización.</p>
  </div>
  <p style="color:#55557a;font-size:.75rem;text-align:center;margin-top:24px">© 2026 PropertyPulse · <a href="${APP_URL}/privacy" style="color:#55557a">Privacy</a></p>
</div>
</body>
</html>`
            });
            console.log(`[EMAIL] Cotización enviada a ${clienteEmail}`);
        } catch (err) {
            console.error('[EMAIL] Error cotización:', err.message);
        }
    },

    // ── 5. Reset de contraseña ────────────────────────────────
    async enviarResetPassword({ nombre, email, resetUrl }) {
        try {
            await resend.emails.send({
                from:    FROM,
                to:      email,
                subject: '🔐 Restablecer contraseña — PropertyPulse',
                html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#08080f;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 20px">
  <div style="text-align:center;margin-bottom:32px">
    <span style="font-size:1.4rem;font-weight:800;color:#f0f0f8">🏢 Property<span style="color:#7c6dfa">Pulse</span></span>
  </div>
  <div style="background:#0f0f1a;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:36px">
    <h1 style="color:#f0f0f8;font-size:1.3rem;font-weight:700;margin:0 0 8px">🔐 Restablecer contraseña</h1>
    <p style="color:#8888aa;font-size:.95rem;line-height:1.6;margin:0 0 24px">
      Hola ${nombre}, recibimos una solicitud para restablecer tu contraseña.
      Este link expira en <strong style="color:#f0f0f8">1 hora</strong>.
    </p>
    <a href="${resetUrl}" style="display:block;background:#7c6dfa;color:#fff;text-align:center;padding:14px;border-radius:10px;text-decoration:none;font-weight:600;font-size:.95rem;margin-bottom:20px">
      Restablecer mi contraseña →
    </a>
    <div style="background:#15152a;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:14px;margin-bottom:20px">
      <p style="color:#55557a;font-size:.75rem;margin:0 0 4px">O copia este link en tu navegador:</p>
      <p style="color:#7c6dfa;font-size:.75rem;word-break:break-all;margin:0">${resetUrl}</p>
    </div>
    <p style="color:#55557a;font-size:.78rem;text-align:center;margin:0">
      Si no solicitaste esto, ignora este email. Tu contraseña no cambiará.
    </p>
  </div>
  <p style="color:#55557a;font-size:.75rem;text-align:center;margin-top:24px">© 2026 PropertyPulse</p>
</div>
</body>
</html>`
            });
            console.log(`[EMAIL] Reset password enviado a ${email}`);
        } catch (err) {
            console.error('[EMAIL] Error reset password:', err.message);
        }
    }
};

module.exports = emailService;
