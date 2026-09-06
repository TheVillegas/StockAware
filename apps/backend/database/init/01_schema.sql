-- =============================================================================
--  StockAware — Esquema inicial
-- -----------------------------------------------------------------------------
--  Réplica en PostgreSQL de los módulos de Compras (OC → HES) y Bodega del
--  ERP VAIPS (MariaDB 10.6, base cre95340_erp).
--
--  Criterio: se replican la estructura y el comportamiento del original,
--  incluidos varios de sus defectos de diseño, como línea base medible. No se
--  arrastran los accidentes del legado (colación mixta, enums con valores
--  vacíos, índices únicos ausentes, columnas de esquemas anteriores).
--
--  Cada decisión que se aparta del original está comentada donde ocurre.
-- =============================================================================

-- =============================================================================
--  1. Tipos enumerados
-- -----------------------------------------------------------------------------
--  unidad_medida es el único que no era un ENUM en el original: allí es un
--  tinyint que apunta por convención a tablas_varias con tipo='UNIDAD', sin
--  llave foránea. Son 7 valores y ya había un material apuntando a un código
--  inexistente, que la vista del mantenedor ocultaba con un INNER JOIN.
--
--  tipo_documento reemplaza los códigos SII '801' (OC), '999' (OC exenta) y
--  'HES'. Como la factura queda fuera del alcance, el código SII no cumple
--  ninguna función.
-- =============================================================================

CREATE TYPE unidad_medida        AS ENUM ('GL','UNI','PAR','KG','LT','CAJA','BOLSA');
CREATE TYPE estado_material      AS ENUM ('ALTA','BAJA');
CREATE TYPE estado_bodega        AS ENUM ('VIGENTE','NO_VIGENTE');
CREATE TYPE estado_ccosto        AS ENUM ('VIGENTE','NO_VIGENTE','ABIERTO','CERRADO');
CREATE TYPE estado_generico      AS ENUM ('ACTIVO','INACTIVO','ELIMINADO');

CREATE TYPE tipo_documento       AS ENUM ('OC','OC_EXENTA','HES');
CREATE TYPE estado_documento     AS ENUM ('PENDIENTE','EMITIDO','CERRADO','ANULADO','ELIMINADO');
CREATE TYPE tipo_moneda          AS ENUM ('CLP','UF','DOLAR','EURO','UTM');

CREATE TYPE tipo_movimiento      AS ENUM ('IN','OUT');
CREATE TYPE tipo_doc_movimiento  AS ENUM ('GR','AJUSTE');

CREATE TYPE tipo_categoria       AS ENUM ('CAT','SUB','IND');
CREATE TYPE tipo_funcion         AS ENUM ('MENU','OPCION','FUNCION','OTRO');
CREATE TYPE tipo_accion          AS ENUM ('INS_REG','MOD_REG','DEL_REG','LOGIN','LOGOUT','EXEC_PROC');


-- =============================================================================
--  2. Categorías
-- -----------------------------------------------------------------------------
--  Jerarquía de 3 niveles: CAT → SUB → IND. El original tiene un cuarto valor,
--  IND_ANULA, que no es un nivel sino un individual dado de baja: eso es estado,
--  no tipo, y aquí es la columna `activa`.
--
--  `padre` era int NOT NULL con 0 como centinela de raíz; ahora es nullable con
--  llave foránea real.
-- =============================================================================

CREATE TABLE categoria (
    id        serial PRIMARY KEY,
    tipo      tipo_categoria NOT NULL,
    padre_id  integer REFERENCES categoria(id),
    codigo    varchar(15)    NOT NULL,
    glosa     varchar(60)    NOT NULL,
    activa    boolean        NOT NULL DEFAULT true,
    UNIQUE (tipo, codigo)
);

CREATE INDEX ix_categoria_padre ON categoria (padre_id);


-- =============================================================================
--  3. Control de acceso
-- -----------------------------------------------------------------------------
--  Modelo perfil × función del ERP: las funciones forman un árbol de menús,
--  opciones y funciones sueltas, y un perfil recibe permisos sobre ellas.
--  Es más expresivo que un rol plano y permite crecer sin rehacerlo.
-- =============================================================================

CREATE TABLE perfil (
    id          serial PRIMARY KEY,
    glosa       varchar(40)     NOT NULL UNIQUE,
    url_inicio  varchar(120),
    estado      estado_generico NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE funcion (
    id           serial PRIMARY KEY,
    tipo         tipo_funcion NOT NULL,
    glosa        varchar(40)  NOT NULL,
    padre_id     integer REFERENCES funcion(id),
    descripcion  text,
    estado       estado_generico NOT NULL DEFAULT 'ACTIVO',
    UNIQUE (tipo, glosa)
);

CREATE INDEX ix_funcion_padre ON funcion (padre_id);

-- El original no tiene índice único sobre (perfil, función) y acumula 28.285
-- filas históricas para 1.207 permisos vigentes. Aquí la restricción existe.
CREATE TABLE permiso (
    id          serial PRIMARY KEY,
    perfil_id   integer NOT NULL REFERENCES perfil(id)  ON DELETE CASCADE,
    funcion_id  integer NOT NULL REFERENCES funcion(id) ON DELETE CASCADE,
    estado      estado_generico NOT NULL DEFAULT 'ACTIVO',
    fecha       date    NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (perfil_id, funcion_id)
);

-- `usuarios` en el ERP tiene DOS columnas de contraseña, usr_clave varchar(50)
-- y usr_passwd varchar(100). Aquí queda una sola, dimensionada para bcrypt.
CREATE TABLE usuario (
    id             serial PRIMARY KEY,
    rut            varchar(12),
    nombre         varchar(80)  NOT NULL,
    email          varchar(120) NOT NULL,
    username       varchar(30)  NOT NULL UNIQUE,
    password_hash  varchar(255) NOT NULL,
    estado         estado_generico NOT NULL DEFAULT 'ACTIVO',
    perfil_id      integer NOT NULL REFERENCES perfil(id),
    vigente_desde  timestamptz,
    vigente_hasta  timestamptz
);


-- =============================================================================
--  4. Centro de costo y bodega
-- -----------------------------------------------------------------------------
--  centro_costo: el original tiene UNIQUE(ccosto, estado) y además
--  UNIQUE(ccosto); el segundo hace redundante al primero y solo queda ese.
--
--  bodega: `bodega.bodega` es varchar(30) en el original pero sus 541 filas son
--  todas numéricas, mientras materiales_x_bodega.id_bodega es int — las vistas
--  los unían por coerción de tipos de MariaDB. Aquí es integer de los dos lados.
--
--  `responsable_id` apunta a data_personal desde bodega y a usuarios desde
--  centro_costo en el original: mismo nombre, dos destinos. StockAware no tiene
--  módulo de RRHH, así que ambos apuntan a usuario.
-- =============================================================================

CREATE TABLE centro_costo (
    id                serial PRIMARY KEY,
    ccosto            varchar(50)   NOT NULL UNIQUE,
    proyecto          varchar(50)   NOT NULL DEFAULT '',
    fecha_inicio      date,
    fecha_fin         date,
    presupuesto       numeric(14,2) NOT NULL DEFAULT 0,
    presupuesto_neto  numeric(14,2) NOT NULL DEFAULT 0,
    estado            estado_ccosto NOT NULL DEFAULT 'VIGENTE',
    responsable_id    integer REFERENCES usuario(id)
);

CREATE TABLE bodega (
    id              serial PRIMARY KEY,
    codigo          integer       NOT NULL UNIQUE,
    descripcion     varchar(60)   NOT NULL,
    estado          estado_bodega NOT NULL DEFAULT 'VIGENTE',
    ccosto_id       integer REFERENCES centro_costo(id),
    fecha_ingreso   date          NOT NULL DEFAULT CURRENT_DATE,
    responsable_id  integer REFERENCES usuario(id)
);


-- =============================================================================
--  5. Proveedor
-- -----------------------------------------------------------------------------
--  En el ERP proveedores y clientes comparten data_clientes, separados por
--  tipo_reg (CLI/PRO/CLPRO), y v_proveedor filtra los dos últimos. StockAware
--  no tiene clientes: la tabla es solo de proveedores y el discriminador
--  desaparece.
--
--  fono y celular eran int(11) — un teléfono no es un entero — y se unifican
--  en un varchar. El catálogo `comunas` se aplana a texto: pertenece a otro
--  módulo.
-- =============================================================================

CREATE TABLE proveedor (
    id               serial PRIMARY KEY,
    rut              varchar(15)  NOT NULL UNIQUE,
    nombre           varchar(50)  NOT NULL,
    apellido         varchar(50)  NOT NULL DEFAULT '',
    direccion        varchar(80),
    comuna           varchar(50),
    ciudad           varchar(40),
    fono             varchar(20),
    email            varchar(80),
    contacto         varchar(40),
    categoria_id     integer REFERENCES categoria(id),
    dias_plazo_pago  smallint     NOT NULL DEFAULT 30,
    estado           estado_generico NOT NULL DEFAULT 'ACTIVO',
    fecha_ingreso    date
);


-- =============================================================================
--  6. Material y stock
-- -----------------------------------------------------------------------------
--  cod_material pasa de índice común a UNIQUE: en el ERP hay 3 códigos
--  duplicados. Se elimina Tipo enum('MATERIAL'), un enumerado de un solo valor
--  heredado de cuando la tabla servía a un negocio de combustibles.
--  ccosto_ap varchar(30) — que en realidad guardaba la categoría contable —
--  pasa a ser una referencia declarada.
-- =============================================================================

CREATE TABLE material (
    id            serial PRIMARY KEY,
    cod_material  varchar(20)     NOT NULL UNIQUE,
    nombre        varchar(120)    NOT NULL,
    estado        estado_material NOT NULL DEFAULT 'ALTA',
    unidad        unidad_medida   NOT NULL,
    categoria_id  integer REFERENCES categoria(id),
    tarifa        numeric(12,2)   NOT NULL DEFAULT 0,
    stock_minimo  numeric(12,2)   NOT NULL DEFAULT 0
);

-- REPLICADO A PROPÓSITO: el saldo es MUTABLE. Se escribe con
-- stock = stock ± cantidad al registrar cada movimiento, y al eliminar un
-- movimiento se revierte a mano. No se deriva del libro de movimientos.
--
-- CAMBIA: se agrega el UNIQUE(material_id, bodega_id) que el original no tiene
-- —hay un par duplicado en producción— y que es lo que obliga al ERP a hacer
-- SELECT COUNT y después INSERT o UPDATE en vez de un upsert.
-- Con la restricción pasa a ser INSERT ... ON CONFLICT DO UPDATE.
--
-- CAMBIA: stock pasa de int a numeric(12,2). Las cantidades de las líneas de OC
-- son decimales y el original las truncaba al llegar al saldo.
CREATE TABLE material_bodega (
    id           serial PRIMARY KEY,
    material_id  integer       NOT NULL REFERENCES material(id),
    bodega_id    integer       NOT NULL REFERENCES bodega(id),
    stock        numeric(12,2) NOT NULL DEFAULT 0,
    UNIQUE (material_id, bodega_id)
);


-- =============================================================================
--  7. Documentos de compra (OC y HES)
-- -----------------------------------------------------------------------------
--  Una sola tabla con discriminador, como el ERP: la OC y la HES viven juntas
--  y la HES referencia a su OC dentro de la misma tabla. Lo que sí se aísla son
--  las columnas: docs_emitidos tiene 45, la mayoría de guías de despacho, notas
--  de crédito y DTE del SII. Aquí quedan las 20 que el módulo usa.
--
--  CAMBIA: el original marca la HES ya cargada a bodega escribiendo la cadena
--  'MF' dentro de la columna HES varchar(30) — una columna reusada como
--  bandera. Aquí es cargada_a_bodega boolean más fecha_carga.
--
--  CAMBIA: el vínculo HES→OC era OC varchar(30) comparado por número; ahora es
--  oc_id con llave foránea al propio documento.
--
--  CAMBIA: la clave única del original es (tipo_doc, numdoc, estado). Incluir
--  el estado permite que el mismo documento exista dos veces con estados
--  distintos, así que el estado sale de la clave.
-- =============================================================================

CREATE TABLE documento (
    id                serial PRIMARY KEY,
    tipo              tipo_documento   NOT NULL,
    numdoc            integer          NOT NULL,
    fecha             timestamptz      NOT NULL DEFAULT now(),
    proveedor_id      integer          NOT NULL REFERENCES proveedor(id),
    estado            estado_documento NOT NULL DEFAULT 'PENDIENTE',

    -- La HES apunta a su OC. REPLICADO A PROPÓSITO: oc_avance es un PORCENTAJE
    -- acumulado (0..100), no una cantidad recibida. Lo pendiente se calcula
    -- como cantidad * (100 - oc_avance) / 100, con el error de redondeo que eso
    -- arrastra en recepciones parciales.
    oc_id             integer REFERENCES documento(id),
    oc_avance         numeric(8,4)     NOT NULL DEFAULT 0,

    neto              numeric(14,2)    NOT NULL DEFAULT 0,
    iva               numeric(14,2)    NOT NULL DEFAULT 0,
    total             numeric(14,2)    NOT NULL DEFAULT 0,

    tipo_moneda       tipo_moneda      NOT NULL DEFAULT 'CLP',
    tipo_cambio       numeric(10,4)    NOT NULL DEFAULT 1,
    fecha_moneda      timestamptz      NOT NULL DEFAULT now(),

    ccosto_id         integer REFERENCES centro_costo(id),
    bodega_id         integer REFERENCES bodega(id),
    cargada_a_bodega  boolean          NOT NULL DEFAULT false,
    fecha_carga       date,

    observacion       varchar(1024),
    usuario_id        integer REFERENCES usuario(id),

    UNIQUE (tipo, numdoc),
    CONSTRAINT hes_referencia_oc
        CHECK (tipo <> 'HES' OR oc_id IS NOT NULL),
    CONSTRAINT avance_en_rango
        CHECK (oc_avance >= 0 AND oc_avance <= 100)
);

CREATE INDEX ix_documento_oc        ON documento (oc_id);
CREATE INDEX ix_documento_proveedor ON documento (proveedor_id);
CREATE INDEX ix_documento_fecha     ON documento (fecha);
CREATE INDEX ix_documento_estado    ON documento (estado);

-- REPLICADO A PROPÓSITO: `nombre` sigue transportando el código del material
-- embebido en el texto, con el formato "DESCRIPCION/MC_412", y la carga a
-- bodega lo extrae partiendo la cadena. Es la decisión de línea base: el
-- problema queda visible y medible antes de resolverlo.
--
-- REPLICADO A PROPÓSITO: `unidad` es texto libre con default 'KG', distinto del
-- enumerado del maestro. El ERP tiene esas dos representaciones conviviendo.
--
-- CAMBIA: el original une cabecera y detalle por la tripleta natural
-- (numdoc, tipo_doc, cliente), sin llave foránea y sin índice único que la
-- respalde. Se reemplaza por documento_id.
-- CAMBIA: `origen_detalle_id` no existe en el ERP. Allí, al eliminar una HES,
-- para saber qué línea de la OC hay que reversar se busca por coincidencia de
-- producto + nombre + precio_uni + unidad + descto, excluyendo las ya usadas
-- (DLL.php, caso ELIMINA_HES). Si dos líneas de la OC comparten esos cinco
-- valores, cuál se reversa depende del ORDER BY id LIMIT 1. Aquí el vínculo es
-- explícito.
CREATE TABLE documento_detalle (
    id            serial PRIMARY KEY,
    documento_id  integer       NOT NULL REFERENCES documento(id) ON DELETE CASCADE,
    origen_detalle_id integer   REFERENCES documento_detalle(id),
    producto      varchar(20),
    nombre        varchar(120)  NOT NULL,
    descripcion   varchar(512)  NOT NULL DEFAULT '',
    comentario    varchar(500),
    cantidad      numeric(12,2) NOT NULL,
    unidad        varchar(20)   NOT NULL DEFAULT 'KG',
    precio_uni    numeric(15,2) NOT NULL,
    descuento     numeric(15,2) NOT NULL DEFAULT 0,
    total         numeric(14,2) NOT NULL,
    oc_avance     numeric(8,4)  NOT NULL DEFAULT 0,
    ccosto_id     integer REFERENCES centro_costo(id),
    categoria_id  integer REFERENCES categoria(id),
    CONSTRAINT detalle_avance_en_rango
        CHECK (oc_avance >= 0 AND oc_avance <= 100)
);

CREATE INDEX ix_detalle_documento ON documento_detalle (documento_id);
CREATE INDEX ix_detalle_origen    ON documento_detalle (origen_detalle_id);


-- =============================================================================
--  8. Movimientos de bodega
-- -----------------------------------------------------------------------------
--  REPLICADO A PROPÓSITO: una entrega a persona escribe DOS filas — un OUT con
--  el centro de costo de la bodega y un IN con el del funcionario, ambas sobre
--  la MISMA bodega — y un solo descuento de saldo. La fila IN no es un ingreso
--  de stock sino una imputación contable. No se agrega ninguna columna que las
--  distinga, aunque eso impide derivar el saldo del libro.
--
--  CAMBIA: mov_bodega es polimórfica, con tipo_vhe de 14 valores (Vehículo,
--  Herramientas, Equipo, Material…) e id_vhe varchar(30) como identificador sin
--  tipo. Vehículos y herramientas quedan fuera del alcance: la tabla es solo de
--  materiales y id_vhe se convierte en material_id con llave foránea.
--
--  CAMBIA: `estado varchar(300)` se renombra a `observacion`, que es lo que
--  realmente contiene.
--
--  CAMBIA: tarifa pasa de int a numeric. El original perdía los decimales del
--  precio unitario.
-- =============================================================================

CREATE TABLE movimiento_bodega (
    id              serial PRIMARY KEY,
    numdoc          integer             NOT NULL,
    tipo_doc        tipo_doc_movimiento NOT NULL DEFAULT 'GR',
    tipo_mov        tipo_movimiento     NOT NULL,
    bodega_id       integer       NOT NULL REFERENCES bodega(id),
    material_id     integer       NOT NULL REFERENCES material(id),
    cantidad        numeric(12,2) NOT NULL,
    unidad          unidad_medida NOT NULL,
    tarifa          numeric(12,2) NOT NULL DEFAULT 0,
    fecha           timestamptz   NOT NULL DEFAULT now(),
    fecha_fin       date,
    ccosto_id       integer REFERENCES centro_costo(id),
    categoria_id    integer REFERENCES categoria(id),
    responsable_id  integer REFERENCES usuario(id),
    documento_id    integer REFERENCES documento(id),
    observacion     varchar(300)  NOT NULL DEFAULT ''
);

CREATE INDEX ix_mov_material_bodega ON movimiento_bodega (material_id, bodega_id);
CREATE INDEX ix_mov_fecha           ON movimiento_bodega (fecha);
CREATE INDEX ix_mov_documento       ON movimiento_bodega (documento_id);


-- =============================================================================
--  9. Auditoría y parámetros
-- -----------------------------------------------------------------------------
--  Toda transacción de usuario —creación, modificación o eliminación— escribe
--  en `registro`. Es requisito contable heredado del ERP, no una conveniencia
--  de depuración.
--
--  CAMBIA: IP varchar(15) pasa a inet, que además acepta IPv6.
-- =============================================================================

CREATE TABLE registro (
    id           bigserial PRIMARY KEY,
    fecha        timestamptz NOT NULL DEFAULT now(),
    usuario_id   integer REFERENCES usuario(id),
    tipo_accion  tipo_accion NOT NULL,
    tabla        varchar(40),
    id_registro  integer,
    inf_1        varchar(500),
    inf_2        varchar(200),
    qstring      text,
    ip           inet
);

CREATE INDEX ix_registro_fecha ON registro (fecha);
CREATE INDEX ix_registro_tabla ON registro (tabla, id_registro);

CREATE TABLE parametro (
    id           serial PRIMARY KEY,
    nombre       varchar(60)   NOT NULL UNIQUE,
    valor        numeric(16,6) NOT NULL,
    descripcion  varchar(250)  NOT NULL DEFAULT ''
);


-- =============================================================================
--  10. Correlativos de documento
-- -----------------------------------------------------------------------------
--  Cada tipo lleva su propio correlativo con un valor de partida distinto —las
--  OC desde 12.000, las HES desde 8.000— y son independientes entre sí, que es
--  lo que hace válido el UNIQUE(tipo, numdoc).
--
--  El ERP resuelve esto con la función Proximo_Valor() sobre una tabla de
--  correlativos. Se usan secuencias de PostgreSQL, que no pierden números por
--  concurrencia. La contrapartida es que una transacción fallida consume un
--  número y deja un hueco en la serie; como ni la OC ni la HES son documentos
--  tributarios, el hueco no tiene consecuencia legal.
-- =============================================================================

CREATE SEQUENCE seq_numdoc_oc         START 12000;
CREATE SEQUENCE seq_numdoc_oc_exenta  START 12000;
CREATE SEQUENCE seq_numdoc_hes        START  8000;
CREATE SEQUENCE seq_numdoc_movimiento START  1;


-- =============================================================================
--  11. Vistas del mantenedor
-- -----------------------------------------------------------------------------
--  Sostienen el patrón Mant_Tablas del ERP y son la razón principal de haber
--  elegido TypeORM, que las trata como entidades de primera clase (@ViewEntity).
--
--  CAMBIA: v_materiales usa INNER JOIN contra el catálogo de unidades y oculta
--  en silencio los materiales con unidad huérfana. Aquí el LEFT JOIN contra
--  categoría garantiza que ningún material desaparezca del mantenedor.
--
--  CAMBIA: v_material_bodega agrega `bajo_minimo`, que el ERP calcula en PHP y
--  que es la señal de reposición que StockAware necesita.
--
--  CAMBIA: v_mov_bodega resuelve nombres de vehículos y herramientas pero NO de
--  materiales —su CASE no contempla ese caso—, así que la columna llega vacía
--  justo para el módulo que nos interesa. Aquí sí se resuelve.
-- =============================================================================

CREATE VIEW v_material AS
SELECT m.id,
       m.cod_material,
       m.nombre,
       m.estado,
       m.unidad,
       m.tarifa,
       m.stock_minimo,
       c.codigo AS categoria_codigo,
       c.glosa  AS categoria
FROM material m
LEFT JOIN categoria c ON c.id = m.categoria_id;


CREATE VIEW v_material_bodega AS
SELECT m.id           AS material_id,
       m.cod_material,
       m.nombre,
       m.estado,
       m.unidad,
       b.id           AS bodega_id,
       b.codigo       AS bodega_codigo,
       b.descripcion  AS bodega,
       mb.stock,
       m.stock_minimo,
       m.tarifa,
       (mb.stock < m.stock_minimo) AS bajo_minimo
FROM material_bodega mb
JOIN material m ON m.id = mb.material_id
JOIN bodega   b ON b.id = mb.bodega_id;


CREATE VIEW v_movimiento_bodega AS
SELECT mv.id,
       mv.numdoc,
       mv.tipo_doc,
       mv.tipo_mov,
       mv.fecha,
       mv.fecha_fin,
       mv.cantidad,
       mv.unidad,
       mv.tarifa,
       mv.observacion,
       m.cod_material,
       m.nombre       AS material,
       b.codigo       AS bodega_codigo,
       b.descripcion  AS bodega,
       cc.ccosto,
       u.nombre       AS responsable,
       d.tipo         AS origen_tipo,
       d.numdoc       AS origen_numdoc
FROM movimiento_bodega mv
JOIN      material     m  ON m.id  = mv.material_id
JOIN      bodega       b  ON b.id  = mv.bodega_id
LEFT JOIN centro_costo cc ON cc.id = mv.ccosto_id
LEFT JOIN usuario      u  ON u.id  = mv.responsable_id
LEFT JOIN documento    d  ON d.id  = mv.documento_id;
