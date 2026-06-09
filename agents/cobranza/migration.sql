-- Tabla de historial de contactos de cobranza
-- Permite al agente calibrar el nivel de escalada basado en contactos anteriores

CREATE TABLE IF NOT EXISTS cobranza_historial (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id     UUID NOT NULL,
  rut_cliente    TEXT NOT NULL,
  cliente        TEXT NOT NULL,
  fecha_contacto DATE NOT NULL DEFAULT CURRENT_DATE,
  nivel_escalada INT  NOT NULL CHECK (nivel_escalada IN (1, 2, 3)),
  folios         TEXT[] NOT NULL,
  monto_total    NUMERIC NOT NULL,
  gmail_draft_id TEXT,
  creado_en      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cobranza_historial_lookup
  ON cobranza_historial (empresa_id, rut_cliente, fecha_contacto DESC);

-- RLS: lectura pública (igual que ventas), escritura solo service_role
ALTER TABLE cobranza_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon puede leer cobranza_historial"
  ON cobranza_historial FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "service_role puede insertar cobranza_historial"
  ON cobranza_historial FOR INSERT
  TO service_role
  WITH CHECK (true);
