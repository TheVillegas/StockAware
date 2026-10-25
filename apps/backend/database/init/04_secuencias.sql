-- Sincroniza las secuencias de identidad con los datos ya cargados.
--
-- Los datos entran por COPY con sus id originales, lo que NO avanza la
-- secuencia. Sin esto, el primer INSERT nuevo pide id=1 y termina chocando
-- con las filas existentes. Hay que correrlo despues de cada carga.
DO $$
DECLARE r record; maximo bigint;
BEGIN
  FOR r IN
    SELECT c.relname AS tabla, a.attname AS columna,
           pg_get_serial_sequence(c.relname, a.attname) AS secuencia
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND a.attnum > 0 AND a.attidentity <> ''
  LOOP
    IF r.secuencia IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX(%I),0) FROM %I', r.columna, r.tabla) INTO maximo;
      PERFORM setval(r.secuencia, GREATEST(maximo, 1), maximo > 0);
    END IF;
  END LOOP;
END $$;
