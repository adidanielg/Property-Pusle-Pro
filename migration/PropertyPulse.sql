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