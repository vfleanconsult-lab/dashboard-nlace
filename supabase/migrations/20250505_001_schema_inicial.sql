-- ============================================================
-- SCHEMA NLACE DASHBOARD — Arquitectura Multiempresa
-- ============================================================

-- ── 1. TABLA MAESTRA: empresas ──────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT        NOT NULL,
  rut        TEXT        NOT NULL UNIQUE,
  plan       TEXT        NOT NULL DEFAULT 'starter',
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. VENTAS (Tipo = Ingreso) ──────────────────────────────
CREATE TABLE IF NOT EXISTS ventas (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID        NOT NULL REFERENCES empresas(id),
  cuenta_cble          TEXT,
  descripcion_cta      TEXT,
  clasificacion_gasto  TEXT,
  clasificacion_cto    TEXT,
  tipo_cuenta          TEXT,
  estado               TEXT,
  mes_economico        TEXT,
  ano_eco              TEXT,
  monto_bruto          NUMERIC(18,2),
  fecha_emision        DATE,
  fecha_pago           DATE,
  fecha_vencimiento    DATE,
  cliente              TEXT,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ventas_empresa_id_idx         ON ventas (empresa_id);
CREATE INDEX IF NOT EXISTS ventas_empresa_mes_idx        ON ventas (empresa_id, mes_economico);
CREATE INDEX IF NOT EXISTS ventas_empresa_estado_idx     ON ventas (empresa_id, estado);

-- ── 3. COSTOS (Tipo = Costo) ────────────────────────────────
CREATE TABLE IF NOT EXISTS costos (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID        NOT NULL REFERENCES empresas(id),
  cuenta_cble          TEXT,
  descripcion_cta      TEXT,
  clasificacion_gasto  TEXT,
  clasificacion_cto    TEXT,
  tipo_cuenta          TEXT,
  estado               TEXT,
  mes_economico        TEXT,
  ano_eco              TEXT,
  monto_bruto          NUMERIC(18,2),
  fecha_emision        DATE,
  fecha_pago           DATE,
  fecha_vencimiento    DATE,
  cliente              TEXT,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS costos_empresa_id_idx         ON costos (empresa_id);
CREATE INDEX IF NOT EXISTS costos_empresa_mes_idx        ON costos (empresa_id, mes_economico);

-- ── 4. GASTOS (Tipo = Gasto) ────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID        NOT NULL REFERENCES empresas(id),
  cuenta_cble          TEXT,
  descripcion_cta      TEXT,
  clasificacion_gasto  TEXT,
  clasificacion_cto    TEXT,
  tipo_cuenta          TEXT,
  estado               TEXT,
  mes_economico        TEXT,
  ano_eco              TEXT,
  monto_bruto          NUMERIC(18,2),
  fecha_emision        DATE,
  fecha_pago           DATE,
  fecha_vencimiento    DATE,
  cliente              TEXT,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gastos_empresa_id_idx         ON gastos (empresa_id);
CREATE INDEX IF NOT EXISTS gastos_empresa_mes_idx        ON gastos (empresa_id, mes_economico);

-- ── 5. REMUNERACIONES (Tipo = Remun) ───────────────────────
CREATE TABLE IF NOT EXISTS remuneraciones (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           UUID        NOT NULL REFERENCES empresas(id),
  cuenta_cble          TEXT,
  descripcion_cta      TEXT,
  clasificacion_gasto  TEXT,
  clasificacion_cto    TEXT,
  tipo_cuenta          TEXT,
  estado               TEXT,
  mes_economico        TEXT,
  ano_eco              TEXT,
  monto_bruto          NUMERIC(18,2),
  fecha_emision        DATE,
  fecha_pago           DATE,
  fecha_vencimiento    DATE,
  cliente              TEXT,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS remuneraciones_empresa_id_idx ON remuneraciones (empresa_id);
CREATE INDEX IF NOT EXISTS remuneraciones_empresa_mes_idx ON remuneraciones (empresa_id, mes_economico);

-- ── 6. VISTA UNIFICADA ─────────────────────────────────────
-- security_invoker=on: RLS de las tablas se evalúa con los permisos del usuario
-- que consulta (no del creador de la vista), necesario para multiempresa.
CREATE OR REPLACE VIEW registros_contables WITH (security_invoker = on) AS
  SELECT id, empresa_id, 'Ingreso' AS tipo,
         cuenta_cble, descripcion_cta, clasificacion_gasto, clasificacion_cto,
         tipo_cuenta, estado, mes_economico, ano_eco, monto_bruto,
         fecha_emision, fecha_pago, fecha_vencimiento, cliente, creado_en
    FROM ventas
  UNION ALL
  SELECT id, empresa_id, 'Costo' AS tipo,
         cuenta_cble, descripcion_cta, clasificacion_gasto, clasificacion_cto,
         tipo_cuenta, estado, mes_economico, ano_eco, monto_bruto,
         fecha_emision, fecha_pago, fecha_vencimiento, cliente, creado_en
    FROM costos
  UNION ALL
  SELECT id, empresa_id, 'Gasto' AS tipo,
         cuenta_cble, descripcion_cta, clasificacion_gasto, clasificacion_cto,
         tipo_cuenta, estado, mes_economico, ano_eco, monto_bruto,
         fecha_emision, fecha_pago, fecha_vencimiento, cliente, creado_en
    FROM gastos
  UNION ALL
  SELECT id, empresa_id, 'Remun' AS tipo,
         cuenta_cble, descripcion_cta, clasificacion_gasto, clasificacion_cto,
         tipo_cuenta, estado, mes_economico, ano_eco, monto_bruto,
         fecha_emision, fecha_pago, fecha_vencimiento, cliente, creado_en
    FROM remuneraciones;

-- ── 7. ROW LEVEL SECURITY ──────────────────────────────────
-- Habilitado en todas las tablas.
-- Policy actual: lectura pública (dashboard sin auth).
-- Estructura sobre empresa_id lista para restringir por tenant en el futuro.

ALTER TABLE empresas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE costos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE remuneraciones ENABLE ROW LEVEL SECURITY;

-- Lectura pública por ahora (anon key puede leer)
CREATE POLICY "lectura_publica_empresas"
  ON empresas FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "lectura_publica_ventas"
  ON ventas FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "lectura_publica_costos"
  ON costos FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "lectura_publica_gastos"
  ON gastos FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "lectura_publica_remuneraciones"
  ON remuneraciones FOR SELECT TO anon, authenticated USING (true);

-- INSERT solo para service_role (migraciones y cargas masivas)
CREATE POLICY "insert_service_ventas"
  ON ventas FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "insert_service_costos"
  ON costos FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "insert_service_gastos"
  ON gastos FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "insert_service_remuneraciones"
  ON remuneraciones FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "insert_service_empresas"
  ON empresas FOR INSERT TO service_role WITH CHECK (true);
