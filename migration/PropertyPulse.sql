-- ============================================================
-- PropertyPulse — SQL COMPLETO
-- Incluye: schema base + push notifications + calificaciones
-- Ejecutar TODO de una vez en: Supabase → SQL Editor → Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- companias (clientes del sistema)
CREATE TABLE IF NOT EXISTS companias (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_contacto   TEXT        NOT NULL,
    nombre_empresa    TEXT        NOT NULL DEFAULT 'Individual',
    email             TEXT        NOT NULL UNIQUE,
    telefono          TEXT        NOT NULL,
    username          TEXT        NOT NULL UNIQUE,
    password          TEXT        NOT NULL,
    tipo_cliente      TEXT        NOT NULL DEFAULT 'Individual'
                                  CHECK (tipo_cliente IN ('Individual','Compania')),
    push_subscription TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companias_username ON companias(username);
CREATE INDEX IF NOT EXISTS idx_companias_email    ON companias(email);

-- tecnicos
CREATE TABLE IF NOT EXISTS tecnicos (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre            TEXT        NOT NULL,
    email             TEXT        NOT NULL UNIQUE,
    telefono          TEXT        NOT NULL,
    username          TEXT        NOT NULL UNIQUE,
    password          TEXT        NOT NULL,
    especialidad      TEXT        NOT NULL,
    activo            BOOLEAN     NOT NULL DEFAULT TRUE,
    push_subscription TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tecnicos_username ON tecnicos(username);

-- propiedades
CREATE TABLE IF NOT EXISTS propiedades (
    id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    direccion             TEXT        NOT NULL,
    compania_id           UUID        NOT NULL REFERENCES companias(id) ON DELETE CASCADE,
    servicios_contratados TEXT,
    lat                   DECIMAL(10,8),
    lng                   DECIMAL(11,8),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_propiedades_compania ON propiedades(compania_id);

-- tickets
CREATE TABLE IF NOT EXISTS tickets (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    propiedad_id     UUID        NOT NULL REFERENCES propiedades(id) ON DELETE CASCADE,
    cliente_id       UUID        NOT NULL REFERENCES companias(id)   ON DELETE CASCADE,
    motivo           TEXT        NOT NULL,
    descripcion      TEXT        NOT NULL,
    estado           TEXT        NOT NULL DEFAULT 'pendiente'
                                 CHECK (estado IN ('pendiente','en_proceso','completado')),
    tecnico_asignado UUID        REFERENCES tecnicos(id) ON DELETE SET NULL,
    categoria        TEXT,
    foto_url         TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_cliente   ON tickets(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado    ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_tecnico   ON tickets(tecnico_asignado);
CREATE INDEX IF NOT EXISTS idx_tickets_propiedad ON tickets(propiedad_id);

-- calificaciones
CREATE TABLE IF NOT EXISTS calificaciones (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id    UUID        NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
    cliente_id   UUID        NOT NULL REFERENCES companias(id) ON DELETE CASCADE,
    tecnico_id   UUID        NOT NULL REFERENCES tecnicos(id)  ON DELETE CASCADE,
    estrellas    INT         NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
    comentario   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calificaciones_tecnico ON calificaciones(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_calificaciones_ticket  ON calificaciones(ticket_id);

-- Deshabilitar RLS en todas las tablas
ALTER TABLE companias      DISABLE ROW LEVEL SECURITY;
ALTER TABLE tecnicos       DISABLE ROW LEVEL SECURITY;
ALTER TABLE propiedades    DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets        DISABLE ROW LEVEL SECURITY;
ALTER TABLE calificaciones DISABLE ROW LEVEL SECURITY;

-- Agregar columna lang a companias y tecnicos
-- Ejecutar en: Supabase → SQL Editor → Run

ALTER TABLE companias ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'es' CHECK (lang IN ('es','en'));
ALTER TABLE tecnicos  ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'es' CHECK (lang IN ('es','en'));

-- Agregar columna lang a companias y tecnicos
-- Ejecutar en: Supabase → SQL Editor → Run

ALTER TABLE companias ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'es' CHECK (lang IN ('es','en'));
ALTER TABLE tecnicos  ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'es' CHECK (lang IN ('es','en'));

-- Agregar columna theme a companias y tecnicos
ALTER TABLE companias ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light' CHECK (theme IN ('light','dark'));
ALTER TABLE tecnicos  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light' CHECK (theme IN ('light','dark'));

-- Agregar columna plan a companias 
ALTER TABLE companias
    ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter'
    CHECK (plan IN ('starter', 'pro', 'business'));

-- Estado cancelado en tickets
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_estado_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_estado_check
    CHECK (estado IN ('pendiente','en_proceso','completado','cancelado'));

-- Log de cancelaciones
CREATE TABLE IF NOT EXISTS cancelaciones (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id     UUID REFERENCES tickets(id) ON DELETE CASCADE,
    cancelado_por TEXT NOT NULL CHECK (cancelado_por IN ('cliente','tecnico')),
    usuario_id    UUID NOT NULL,
    usuario_nombre TEXT,
    motivo        TEXT,
    categoria     TEXT,
    titulo        TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Mensajes de chat por ticket (temporal — se pueden limpiar)
CREATE TABLE IF NOT EXISTS ticket_mensajes (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id  UUID REFERENCES tickets(id) ON DELETE CASCADE,
    autor_id   UUID NOT NULL,
    autor_nombre TEXT,
    autor_rol  TEXT CHECK (autor_rol IN ('cliente','tecnico')),
    mensaje    TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_mensajes_ticket ON ticket_mensajes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_cancelaciones_ticket   ON cancelaciones(ticket_id);

-- ── Soft delete en propiedades y tickets ─────────────────────
ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE tickets     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ── Índices adicionales para performance ─────────────────────
-- Tickets (columnas reales: cliente_id, tecnico_asignado)
CREATE INDEX IF NOT EXISTS idx_tickets_created      ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_deleted      ON tickets (deleted_at) WHERE deleted_at IS NULL;

-- Propiedades
CREATE INDEX IF NOT EXISTS idx_propiedades_deleted  ON propiedades (deleted_at) WHERE deleted_at IS NULL;

-- Ticket mensajes (chat)
CREATE INDEX IF NOT EXISTS idx_mensajes_created     ON ticket_mensajes (created_at ASC);

-- ── Vistas de registros activos (sin deleted) ─────────────────
CREATE OR REPLACE VIEW propiedades_activas AS
    SELECT * FROM propiedades WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW tickets_activos AS
    SELECT * FROM tickets WHERE deleted_at IS NULL;

-- ── Sistema de fees para técnicos ────────────────────────────

-- Tabla de fees acumulados por trabajo
CREATE TABLE IF NOT EXISTS fees_tecnicos (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    tecnico_id  UUID        NOT NULL REFERENCES tecnicos(id) ON DELETE CASCADE,
    ticket_id   UUID        NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
    monto       DECIMAL(10,2) NOT NULL DEFAULT 4.50,
    es_gratis   BOOLEAN     NOT NULL DEFAULT FALSE,
    cobrado     BOOLEAN     NOT NULL DEFAULT FALSE,
    cobrado_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fees_tecnico  ON fees_tecnicos(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_fees_ticket   ON fees_tecnicos(ticket_id);
CREATE INDEX IF NOT EXISTS idx_fees_cobrado  ON fees_tecnicos(cobrado);

ALTER TABLE fees_tecnicos DISABLE ROW LEVEL SECURITY;

-- Vista de resumen de fees por técnico
CREATE OR REPLACE VIEW resumen_fees AS
SELECT
    t.id         AS tecnico_id,
    t.nombre,
    t.especialidad,
    COUNT(f.id)                                          AS total_trabajos,
    COUNT(f.id) FILTER (WHERE f.es_gratis = FALSE)       AS trabajos_con_fee,
    SUM(f.monto) FILTER (WHERE f.cobrado = FALSE AND f.es_gratis = FALSE) AS fee_pendiente,
    SUM(f.monto) FILTER (WHERE f.cobrado = TRUE)         AS fee_cobrado,
    AVG(c.estrellas)                                     AS promedio_estrellas
FROM tecnicos t
LEFT JOIN fees_tecnicos f  ON f.tecnico_id = t.id
LEFT JOIN calificaciones c ON c.tecnico_id = t.id
GROUP BY t.id, t.nombre, t.especialidad;

-- ============================================================
-- PropertyPulse — Migración: técnico ocupado
-- Ejecutar en Supabase → SQL Editor → Run
-- ============================================================

-- Agregar columna ocupado a técnicos
ALTER TABLE tecnicos 
    ADD COLUMN IF NOT EXISTS ocupado BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para filtrar técnicos disponibles rápido
CREATE INDEX IF NOT EXISTS idx_tecnicos_disponible 
    ON tecnicos(activo, ocupado) 
    WHERE activo = TRUE AND ocupado = FALSE;

-- Marcar como libre a todos los técnicos que no tengan ticket en_proceso
-- (sincronizar estado actual)
UPDATE tecnicos t
SET ocupado = TRUE
WHERE EXISTS (
    SELECT 1 FROM tickets tk
    WHERE tk.tecnico_asignado = t.id
    AND tk.estado = 'en_proceso'
);

-- ── Migración: Stripe columns ──────────────────────────────────
-- Ejecutar en Supabase SQL Editor

-- Agregar columnas de Stripe a la tabla companias
ALTER TABLE companias
    ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
    ADD COLUMN IF NOT EXISTS suscripcion_activa       BOOLEAN DEFAULT FALSE;

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_companias_stripe_customer
    ON companias(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_companias_stripe_subscription
    ON companias(stripe_subscription_id);

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'companias'
  AND column_name IN ('stripe_customer_id', 'stripe_subscription_id', 'suscripcion_activa', 'plan');

  -- ── Migración: Password Reset Tokens ────────────────────────
-- Ejecutar en Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL,
    user_role  TEXT        NOT NULL CHECK (user_role IN ('cliente', 'tecnico')),
    token      TEXT        NOT NULL UNIQUE,
    used       BOOLEAN     NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token   ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user    ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

ALTER TABLE password_reset_tokens DISABLE ROW LEVEL SECURITY;

-- Limpiar tokens expirados automáticamente (opcional, correr periódicamente)
-- DELETE FROM password_reset_tokens WHERE expires_at < NOW();

-- ── Migración: Códigos de invitación para técnicos ──────────
-- Ejecutar en Supabase → SQL Editor → Run

CREATE TABLE IF NOT EXISTS codigos_invitacion (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo     TEXT        NOT NULL UNIQUE,
    usado      BOOLEAN     NOT NULL DEFAULT FALSE,
    usado_por  UUID        REFERENCES tecnicos(id) ON DELETE SET NULL,
    usado_at   TIMESTAMPTZ,
    creado_por TEXT        NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_codigos_codigo ON codigos_invitacion(codigo);
CREATE INDEX IF NOT EXISTS idx_codigos_usado  ON codigos_invitacion(usado);

ALTER TABLE codigos_invitacion DISABLE ROW LEVEL SECURITY;

-- Agregar columna invitado a tecnicos
ALTER TABLE tecnicos ADD COLUMN IF NOT EXISTS invitado BOOLEAN DEFAULT FALSE;

-- ── Migración: Suscripción técnicos ──────────────────────────
-- Ejecutar en Supabase → SQL Editor → Run

ALTER TABLE tecnicos
    ADD COLUMN IF NOT EXISTS suscripcion_activa      BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT;

CREATE INDEX IF NOT EXISTS idx_tecnicos_stripe_customer
    ON tecnicos(stripe_customer_id);