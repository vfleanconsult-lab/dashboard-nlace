-- ============================================================
-- CATÁLOGO DE ALIAS — tabla Catalogo_Clientes
--
-- Usada por el módulo ActualizarEstadoFacturas para resolver
-- clientes que pagan vía terceros (Chipax, etc.).
-- El campo descripcion_movimiento es la keyword que aparece
-- en la descripción del movimiento bancario.
-- Un mismo alias puede mapear a múltiples clientes (desempate por monto).
-- ============================================================

CREATE TABLE IF NOT EXISTS "Catalogo_Clientes" (
  id                    SERIAL PRIMARY KEY,
  "RUT"                 TEXT NOT NULL,
  cliente               TEXT NOT NULL,
  descripcion_movimiento TEXT NOT NULL
);

GRANT SELECT ON "Catalogo_Clientes" TO anon, authenticated;

INSERT INTO "Catalogo_Clientes" ("RUT", cliente, descripcion_movimiento) VALUES
  ('76581730-7', 'NOISE SPA',            '0765817307 PAGO PROVEEDOR PODCAST'),
  ('76477884-7', 'AGROINTEGRAL SPA',     '0765500818 Transf. Chipax SpA'),
  ('76389181-K', 'VENTA DE INSUMOS AGRICOLAS MATHIAS QUIROZ AHUMADA E.I.R.L.', '0765500818 Transf. Chipax SpA')
ON CONFLICT DO NOTHING;
