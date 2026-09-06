-- =============================================================================
--  StockAware — Datos semilla
-- -----------------------------------------------------------------------------
--  Valores genéricos, solo para que el sistema arranque y se pueda trabajar.
--  NO son datos reales ni anonimizados del ERP: poblar con datos reales es una
--  etapa posterior, cuando la réplica ya funcione.
--
--  Los ids van explícitos para que las referencias sean legibles; al final se
--  reposicionan las secuencias.
-- =============================================================================

SET client_encoding = 'UTF8';

-- -----------------------------------------------------------------------------
--  Categorías — jerarquía CAT → SUB → IND
-- -----------------------------------------------------------------------------
INSERT INTO categoria (id, tipo, padre_id, codigo, glosa) VALUES
    (1, 'CAT', NULL, 'EPP',      'Elementos de protección personal'),
    (2, 'CAT', NULL, 'INSUMO',   'Insumos y consumibles'),
    (3, 'CAT', NULL, 'HERR',     'Herramientas'),

    (4, 'SUB', 1,    'EPP-CAB',  'Protección de cabeza'),
    (5, 'SUB', 1,    'EPP-MAN',  'Protección de manos'),
    (6, 'SUB', 2,    'INS-LIM',  'Limpieza'),
    (7, 'SUB', 3,    'HER-MAN',  'Herramientas manuales'),

    (8, 'IND', 4,    'IND-CASC', 'Cascos'),
    (9, 'IND', 5,    'IND-GUAN', 'Guantes'),
    (10,'IND', 6,    'IND-ASEO', 'Artículos de aseo'),
    (11,'IND', 7,    'IND-LLAV', 'Llaves y destornilladores');

-- -----------------------------------------------------------------------------
--  Perfiles y árbol de funciones de acceso
-- -----------------------------------------------------------------------------
INSERT INTO perfil (id, glosa, url_inicio) VALUES
    (1, 'Administrador', '/inicio'),
    (2, 'Bodega',        '/bodega'),
    (3, 'Adquisiciones', '/compras'),
    (4, 'Consulta',      '/inicio');

INSERT INTO funcion (id, tipo, glosa, padre_id, descripcion) VALUES
    -- Menús
    (1,  'MENU',    'Compras',              NULL, 'Órdenes de compra y recepciones'),
    (2,  'MENU',    'Bodega',               NULL, 'Inventario y movimientos'),
    (3,  'MENU',    'Mantenedores',         NULL, 'Tablas maestras'),

    -- Opciones de Compras
    (10, 'OPCION',  'Órdenes de compra',    1,    'Listado y emisión de OC'),
    (11, 'OPCION',  'Recepciones (HES)',    1,    'Emisión de HES contra OC'),

    -- Opciones de Bodega
    (20, 'OPCION',  'Stock por bodega',     2,    'Saldos y alertas de mínimo'),
    (21, 'OPCION',  'Carga desde HES',      2,    'Ingreso de material a bodega'),
    (22, 'OPCION',  'Movimientos',          2,    'Entregas, traspasos y ajustes'),

    -- Opciones de Mantenedores
    (30, 'OPCION',  'Materiales',           3,    NULL),
    (31, 'OPCION',  'Bodegas',              3,    NULL),
    (32, 'OPCION',  'Proveedores',          3,    NULL),
    (33, 'OPCION',  'Categorías',           3,    NULL),
    (34, 'OPCION',  'Centros de costo',     3,    NULL),
    (35, 'OPCION',  'Usuarios y perfiles',  3,    NULL),

    -- Funciones sujetas a permiso explícito
    (40, 'FUNCION', 'Aprueba OC',           10,   'Pasa la OC de PENDIENTE a EMITIDO'),
    (41, 'FUNCION', 'Anula OC',             10,   NULL),
    (42, 'FUNCION', 'Anula HES',            11,   NULL),
    (43, 'FUNCION', 'Elimina movimiento',   22,   'Revierte el saldo del movimiento'),
    (44, 'FUNCION', 'Ajusta stock',         22,   NULL);

-- El administrador recibe todo.
INSERT INTO permiso (perfil_id, funcion_id)
SELECT 1, id FROM funcion;

-- Bodega: su menú, sus opciones y las funciones de movimiento.
INSERT INTO permiso (perfil_id, funcion_id)
SELECT 2, id FROM funcion WHERE id IN (2, 20, 21, 22, 30, 31, 43, 44);

-- Adquisiciones: compras y los mantenedores que necesita.
INSERT INTO permiso (perfil_id, funcion_id)
SELECT 3, id FROM funcion WHERE id IN (1, 10, 11, 30, 32, 33, 34, 40, 41, 42);

-- Consulta: solo lectura de los menús principales.
INSERT INTO permiso (perfil_id, funcion_id)
SELECT 4, id FROM funcion WHERE id IN (1, 2, 10, 11, 20, 22);

-- -----------------------------------------------------------------------------
--  Usuarios
-- -----------------------------------------------------------------------------
--  ATENCIÓN: password_hash lleva un marcador, no un hash válido. El login se
--  implementa en la fase 2 y ahí se generan los hashes reales. Ningún usuario
--  puede autenticarse con estos valores, que es lo correcto para una semilla.
-- -----------------------------------------------------------------------------
INSERT INTO usuario (id, rut, nombre, email, username, password_hash, perfil_id) VALUES
    (1, '11111111-1', 'Administrador',     'admin@stockaware.local',    'admin',    'PENDIENTE_FASE_2', 1),
    (2, '22222222-2', 'Encargado Bodega',  'bodega@stockaware.local',   'bodega',   'PENDIENTE_FASE_2', 2),
    (3, '33333333-3', 'Adquisiciones',     'compras@stockaware.local',  'compras',  'PENDIENTE_FASE_2', 3);

-- -----------------------------------------------------------------------------
--  Centro de costo y bodegas
-- -----------------------------------------------------------------------------
INSERT INTO centro_costo (id, ccosto, proyecto, fecha_inicio, fecha_fin, presupuesto, responsable_id) VALUES
    (1, 'CC-GENERAL', 'Operación general', CURRENT_DATE, CURRENT_DATE + 365, 50000000, 1),
    (2, 'CC-OBRA-01', 'Obra de ejemplo',   CURRENT_DATE, CURRENT_DATE + 180, 12000000, 3);

INSERT INTO bodega (id, codigo, descripcion, ccosto_id, responsable_id) VALUES
    (1, 1, 'Bodega Central',  1, 2),
    (2, 2, 'Bodega de Obra',  2, 2);

-- -----------------------------------------------------------------------------
--  Proveedores
-- -----------------------------------------------------------------------------
INSERT INTO proveedor (id, rut, nombre, apellido, direccion, comuna, ciudad, fono, email, contacto, categoria_id, fecha_ingreso) VALUES
    (1, '76000001-K', 'Suministros Genéricos', 'SpA', 'Av. Ejemplo 1234', 'Valparaíso', 'Valparaíso', '+56320000001', 'ventas@proveedor-uno.local',  'Contacto Uno', 2, CURRENT_DATE),
    (2, '76000002-8', 'Seguridad Industrial',  'Ltda','Calle Ficticia 567','Viña del Mar','Valparaíso','+56320000002', 'ventas@proveedor-dos.local',  'Contacto Dos', 1, CURRENT_DATE);

-- -----------------------------------------------------------------------------
--  Materiales
-- -----------------------------------------------------------------------------
INSERT INTO material (id, cod_material, nombre, unidad, categoria_id, tarifa, stock_minimo) VALUES
    (1,  'MC_001', 'Casco de seguridad blanco',        'UNI',   8,  8990,  20),
    (2,  'MC_002', 'Guante cabritilla talla 9',        'PAR',   9,  4500,  40),
    (3,  'MC_003', 'Guante nitrilo talla 8',           'PAR',   9,  2300,  60),
    (4,  'MC_004', 'Lentes de seguridad claros',       'UNI',   8,  3200,  30),
    (5,  'MC_005', 'Detergente industrial',            'LT',   10,  1890,  50),
    (6,  'MC_006', 'Paño de limpieza multiuso',        'UNI',  10,   690, 100),
    (7,  'MC_007', 'Llave ajustable 10 pulgadas',      'UNI',  11, 12500,   5),
    (8,  'MC_008', 'Destornillador paleta mediano',    'UNI',  11,  3900,  10),
    (9,  'MC_009', 'Cinta aisladora negra',            'UNI',  10,   990,  40),
    (10, 'MC_010', 'Bolsa de basura 80x110',           'BOLSA',10,  4990,  25);

-- Stock inicial en la bodega central. La de obra parte vacía a propósito, para
-- poder probar el traspaso entre bodegas.
INSERT INTO material_bodega (material_id, bodega_id, stock) VALUES
    (1, 1, 35), (2, 1, 80), (3, 1, 120), (4, 1, 45), (5, 1, 60),
    (6, 1, 200), (7, 1, 8), (8, 1, 15), (9, 1, 90), (10, 1, 40);

-- -----------------------------------------------------------------------------
--  Parámetros del sistema
-- -----------------------------------------------------------------------------
INSERT INTO parametro (nombre, valor, descripcion) VALUES
    ('BODEGA_DEFAULT', 1,    'Bodega usada cuando el documento no indica una'),
    ('IVA',            0.19, 'Tasa de IVA aplicada a las OC afectas'),
    ('DIAS_PAGO_DEF',  30,   'Plazo de pago por defecto para proveedores nuevos');

-- -----------------------------------------------------------------------------
--  Reposicionar las secuencias de las tablas sembradas con id explícito
-- -----------------------------------------------------------------------------
SELECT setval('categoria_id_seq',    (SELECT MAX(id) FROM categoria));
SELECT setval('perfil_id_seq',       (SELECT MAX(id) FROM perfil));
SELECT setval('funcion_id_seq',      (SELECT MAX(id) FROM funcion));
SELECT setval('usuario_id_seq',      (SELECT MAX(id) FROM usuario));
SELECT setval('centro_costo_id_seq', (SELECT MAX(id) FROM centro_costo));
SELECT setval('bodega_id_seq',       (SELECT MAX(id) FROM bodega));
SELECT setval('proveedor_id_seq',    (SELECT MAX(id) FROM proveedor));
SELECT setval('material_id_seq',     (SELECT MAX(id) FROM material));
