<<<<<<< Updated upstream
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
=======
-- Replica ERP VAIPS -> PostgreSQL
-- Generado desde information_schema de cre95340_erp
-- 69 tablas, 79 tipos enum, 134 indices
-- default descartado: acceso_funciones.acc_fini (default invalido 'NULL')
-- default descartado: acceso_funciones.acc_ffin (default invalido 'NULL')
-- default descartado: acceso_funciones.acc_descripcion (default invalido 'NULL')
-- default descartado: acceso_perfiles.url_inicio (default invalido 'NULL')
-- default descartado: acceso_perfiles.per_fini (default invalido 'NULL')
-- default descartado: acceso_perfiles.per_ffin (default invalido 'NULL')
-- default descartado: data_clientes.rut (default invalido 'NULL')
-- default descartado: data_clientes.ciudad (default invalido 'NULL')
-- default descartado: data_clientes.email (default invalido 'NULL')
-- default descartado: data_clientes.contacto (default invalido 'NULL')
-- default descartado: data_clientes.bco_direcc (default invalido 'NULL')
-- default descartado: data_clientes.bco_comuna (default invalido 'NULL')
-- default descartado: data_clientes.bco_fono (default invalido 'NULL')
-- default descartado: data_clientes.categoria (default invalido 'NULL')
-- default descartado: data_clientes.fingreso (default invalido 'NULL')
-- default descartado: data_clientes.codigo_cc (default invalido 'NULL')
-- default descartado: data_clientes_bco.cliente (default invalido 'NULL')
-- default descartado: data_clientes_bco.ctacte (default invalido 'NULL')
-- default descartado: data_clientes_bco.banco (default invalido 'NULL')
-- default descartado: data_clientes_cargos.obs (default invalido 'NULL')
-- default descartado: data_clientes_cargos.fecha_pago (default invalido 'NULL')
-- default descartado: data_clientes_cargos.num_pago (default invalido 'NULL')
-- default descartado: data_clientes_cheques.fec_deposito (default invalido 'NULL')
-- default descartado: data_clientes_cheques.num_deposito (default invalido 'NULL')
-- default descartado: data_clientes_cheques.bco_deposito (default invalido 'NULL')
-- default descartado: data_clientes_cheques.fec_protesto (default invalido 'NULL')
-- default descartado: data_clientes_cheques.num_protesto (default invalido 'NULL')
-- default descartado: data_clientes_cheques.id_deposito (default invalido 'NULL')
-- default descartado: data_clientes_factura.distribuidor (default invalido 'NULL')
-- default descartado: data_clientes_factura.rut (default invalido 'NULL')
-- default descartado: data_clientes_factura.razon (default invalido 'NULL')
-- default descartado: data_clientes_factura.giro (default invalido 'NULL')
-- default descartado: data_clientes_factura.direcc (default invalido 'NULL')
-- default descartado: data_clientes_factura.comuna (default invalido 'NULL')
-- default descartado: data_clientes_factura.ciudad (default invalido 'NULL')
-- default descartado: data_clientes_factura.fono (default invalido 'NULL')
-- default descartado: data_clientes_factura.email (default invalido 'NULL')
-- default descartado: data_clientes_factura.contacto (default invalido 'NULL')
-- default descartado: data_clientes_sucursal.cliente (default invalido 'NULL')
-- default descartado: data_personal.rut (default invalido 'NULL')
-- default descartado: data_personal.ciudad (default invalido 'NULL')
-- default descartado: data_personal.email (default invalido 'NULL')
-- default descartado: data_personal.contacto (default invalido 'NULL')
-- default descartado: depositos.bodega (default invalido 'NULL')
-- default descartado: depositos.n_docs (default invalido 'NULL')
-- default descartado: depositos.cheques_id (default invalido 'NULL')
-- default descartado: depositos.tot_docs (default invalido 'NULL')
-- default descartado: depositos.efectivo (default invalido 'NULL')
-- default descartado: depositos.fecha_efectivo (default invalido 'NULL')
-- default descartado: docs_emitidos.numdoc (default invalido 'NULL')
-- default descartado: docs_emitidos.tipo_NC (default invalido 'NULL')
-- default descartado: docs_emitidos.fecha (default invalido 'NULL')
-- default descartado: docs_emitidos.cliente (default invalido 'NULL')
-- default descartado: docs_emitidos.rut (default invalido 'NULL')
-- default descartado: docs_emitidos.TpoVenta (default invalido 'NULL')
-- default descartado: docs_emitidos.total (default invalido 'NULL')
-- default descartado: docs_emitidos.neto (default invalido 'NULL')
-- default descartado: docs_emitidos.iva (default invalido 'NULL')
-- default descartado: docs_emitidos.ref_num (default invalido 'NULL')
-- default descartado: docs_emitidos.ref_tipo (default invalido 'NULL')
-- default descartado: docs_emitidos.ref_id (default invalido 'NULL')
-- default descartado: docs_emitidos.guia_ind_traslado (default invalido 'NULL')
-- default descartado: docs_emitidos.guia_patente (default invalido 'NULL')
-- default descartado: docs_emitidos.guia_rut_transporte (default invalido 'NULL')
-- default descartado: docs_emitidos.guia_direcc (default invalido 'NULL')
-- default descartado: docs_emitidos.guia_comuna (default invalido 'NULL')
-- default descartado: docs_emitidos.guia_ciudad (default invalido 'NULL')
-- default descartado: docs_emitidos.dat_ref (default invalido 'NULL')
-- default descartado: docs_emitidos.obs (default invalido 'NULL')
-- default descartado: docs_emitidos.url_PDF (default invalido 'NULL')
-- default descartado: docs_emitidos.url_XML (default invalido 'NULL')
-- default descartado: docs_emitidos.OC (default invalido 'NULL')
-- default descartado: docs_emitidos.OC_fecha (default invalido 'NULL')
-- default descartado: docs_emitidos.HES (default invalido 'NULL')
-- default descartado: docs_emitidos.HES_fecha (default invalido 'NULL')
-- default descartado: docs_emitidos.bodega (default invalido 'NULL')
-- default descartado: docs_emitidos.usuario (default invalido 'NULL')
-- default descartado: docs_emitidos_detalle.numdoc (default invalido 'NULL')
-- default descartado: docs_emitidos_detalle.producto (default invalido 'NULL')
-- default descartado: docs_emitidos_detalle.cantidad (default invalido 'NULL')
-- default descartado: docs_emitidos_detalle.precio_uni (default invalido 'NULL')
-- default descartado: docs_emitidos_detalle.descto (default invalido 'NULL')
-- default descartado: docs_emitidos_detalle.comentario (default invalido 'NULL')
-- default descartado: docs_pagos.fec_venc (default invalido 'NULL')
-- default descartado: docs_pagos.banco (default invalido 'NULL')
-- default descartado: docs_pagos.num_cheque (default invalido 'NULL')
-- default descartado: docs_pagos.num_ctacte (default invalido 'NULL')
-- default descartado: docs_pagos_fac.cliente (default invalido 'NULL')
-- default descartado: docs_pagos_fac.total_pago (default invalido 'NULL')
-- default descartado: docs_pagos_fac.total_fac (default invalido 'NULL')
-- default descartado: docs_pagos_fac.fecha (default invalido 'NULL')
-- default descartado: docs_recibidos.numdoc (default invalido 'NULL')
-- default descartado: docs_recibidos.tipo_NC (default invalido 'NULL')
-- default descartado: docs_recibidos.fecha (default invalido 'NULL')
-- default descartado: docs_recibidos.cliente (default invalido 'NULL')
-- default descartado: docs_recibidos.rut (default invalido 'NULL')
-- default descartado: docs_recibidos.total (default invalido 'NULL')
-- default descartado: docs_recibidos.neto (default invalido 'NULL')
-- default descartado: docs_recibidos.iva (default invalido 'NULL')
-- default descartado: docs_recibidos.ref_num (default invalido 'NULL')
-- default descartado: docs_recibidos.ref_tipo (default invalido 'NULL')
-- default descartado: docs_recibidos.guia_ind_traslado (default invalido 'NULL')
-- default descartado: docs_recibidos.guia_tipo_despacho (default invalido 'NULL')
-- default descartado: docs_recibidos.guia_forma_pago (default invalido 'NULL')
-- default descartado: docs_recibidos.guia_estado (default invalido 'NULL')
-- default descartado: docs_recibidos.guia_patente (default invalido 'NULL')
-- default descartado: docs_recibidos.guia_rut_transporte (default invalido 'NULL')
-- default descartado: docs_recibidos.guia_direcc (default invalido 'NULL')
-- default descartado: docs_recibidos.guia_comuna (default invalido 'NULL')
-- default descartado: docs_recibidos.guia_ciudad (default invalido 'NULL')
-- default descartado: docs_recibidos.obs (default invalido 'NULL')
-- default descartado: docs_recibidos.url_PDF (default invalido 'NULL')
-- default descartado: docs_recibidos.url_XML (default invalido 'NULL')
-- default descartado: docs_recibidos.OC (default invalido 'NULL')
-- default descartado: docs_recibidos.OC_fecha (default invalido 'NULL')
-- default descartado: docs_recibidos.HES (default invalido 'NULL')
-- default descartado: docs_recibidos.HES_fecha (default invalido 'NULL')
-- default descartado: docs_recibidos.bodega (default invalido 'NULL')
-- default descartado: docs_recibidos_detalle.numdoc (default invalido 'NULL')
-- default descartado: docs_recibidos_detalle.producto (default invalido 'NULL')
-- default descartado: docs_recibidos_detalle.cantidad (default invalido 'NULL')
-- default descartado: docs_recibidos_detalle.precio_uni (default invalido 'NULL')
-- default descartado: docs_recibidos_detalle.descto (default invalido 'NULL')
-- default descartado: docs_recibidos_detalle.ccosto_ap (default invalido 'NULL')
-- default descartado: herramientas.Nom_equipo (default invalido 'NULL')
-- default descartado: herramientas.Serie (default invalido 'NULL')
-- default descartado: herramientas.certificado (default invalido 'NULL')
-- default descartado: herramientas.tipoCertificacion (default invalido 'NULL')
-- default descartado: herramientas.frecuenciaCertificacion (default invalido 'NULL')
-- default descartado: herramientas.Ult_certificacion (default invalido 'NULL')
-- default descartado: herramientas.tipoCalibracion (default invalido 'NULL')
-- default descartado: herramientas.frecuenciaCalibracion (default invalido 'NULL')
-- default descartado: herramientas.Ult_calibracion (default invalido 'NULL')
-- default descartado: herramientas.Marca (default invalido 'NULL')
-- default descartado: herramientas.Modelo (default invalido 'NULL')
-- default descartado: herramientas.propiosVaips (default invalido 'NULL')
-- default descartado: herramientas.Comentario (default invalido 'NULL')
-- default descartado: herramientas.Ubicacion (default invalido 'NULL')
-- default descartado: lugar_trabajo.owner (default invalido 'NULL')
-- default descartado: materiales.nombre (default invalido 'NULL')
-- default descartado: materiales.unidad (default invalido 'NULL')
-- default descartado: mov_bodega.numdoc (default invalido 'NULL')
-- default descartado: mov_bodega.tipoDoc (default invalido 'NULL')
-- default descartado: mov_bodega.id_responsable (default invalido 'NULL')
-- default descartado: pagos.lote_pago (default invalido 'NULL')
-- default descartado: pagos.fecha_valida (default invalido 'NULL')
-- default descartado: pagos.user_valida (default invalido 'NULL')
-- default descartado: pagos.fecha_confirma_pago (default invalido 'NULL')
-- default descartado: pagos.user_confirma (default invalido 'NULL')
-- default descartado: registro.tabla_accion (default invalido 'NULL')
-- default descartado: registro.id_registro (default invalido 'NULL')
-- default descartado: registro.inf_1 (default invalido 'NULL')
-- default descartado: registro.inf_2 (default invalido 'NULL')
-- default descartado: rinde_gastos.rut_proveedor (default invalido 'NULL')
-- default descartado: rinde_gastos.cod_tipo_doc (default invalido 'NULL')
-- default descartado: rinde_gastos.categoria (default invalido 'NULL')
-- default descartado: rinde_gastos.subCategoria (default invalido 'NULL')
-- default descartado: rinde_gastos.indicador (default invalido 'NULL')
-- default descartado: rinde_gastos.URL_informe (default invalido 'NULL')
-- default descartado: rinde_gastos.URL_Boleta (default invalido 'NULL')
-- default descartado: rinde_gastos.estado (default invalido 'NULL')
-- default descartado: sot_at.inicio (default invalido 'NULL')
-- default descartado: sot_at.fin (default invalido 'NULL')
-- default descartado: sot_at.ganancia_potencial (default invalido 'NULL')
-- default descartado: sot_at.hh_utilizadas (default invalido 'NULL')
-- default descartado: sot_at.costo_estimado_actividad (default invalido 'NULL')
-- default descartado: sot_at_personal.costo_hh (default invalido 'NULL')
-- default descartado: sot_entregable.tipo (default invalido 'NULL')
-- default descartado: sot_entregable.fecha_inicio (default invalido 'NULL')
-- default descartado: sot_entregable.fecha_entrega (default invalido 'NULL')
-- default descartado: sot_entregable.archivo_url (default invalido 'NULL')
-- default descartado: sot_entregable.responsable_codigo (default invalido 'NULL')
-- default descartado: sot_equipo.tipo (default invalido 'NULL')
-- default descartado: sot_equipo.subtipo (default invalido 'NULL')
-- default descartado: sot_equipo.kv (default invalido 'NULL')
-- default descartado: sot_equipo.letra (default invalido 'NULL')
-- default descartado: sot_informe.numero (default invalido 'NULL')
-- default descartado: sot_presupuesto.origen_id (default invalido 'NULL')
-- default descartado: sot_presupuesto.cuenta_cargo_at (default invalido 'NULL')
-- default descartado: sot_presupuesto.fecha_ejecucion (default invalido 'NULL')
-- default descartado: sot_presupuesto.alojamiento (default invalido 'NULL')
-- default descartado: sot_presupuesto.observaciones (default invalido 'NULL')
-- default descartado: sot_presupuesto.aclaraciones (default invalido 'NULL')
-- default descartado: sot_presupuesto_material.tipo (default invalido 'NULL')
-- default descartado: sot_presupuesto_material.unidad (default invalido 'NULL')
-- default descartado: sot_trabajo.orden_mantenimiento (default invalido 'NULL')
-- default descartado: sot_trabajo.tipo_intervencion (default invalido 'NULL')
-- default descartado: sot_trabajo.fecha (default invalido 'NULL')
-- default descartado: sot_trabajo.equipo_id (default invalido 'NULL')
-- default descartado: sot_trabajo.oc_id (default invalido 'NULL')
-- default descartado: sot_trabajo.descuentos_multas (default invalido 'NULL')
-- default descartado: sot_trabajo.oc_numero (default invalido 'NULL')
-- default descartado: sot_trabajo_u_obra.cantidad_planificada (default invalido 'NULL')
-- default descartado: sot_trabajo_u_obra.cantidad_ejecutada (default invalido 'NULL')
-- default descartado: tablas_varias.valor3 (default invalido 'NULL')
-- default descartado: tablas_varias.valor4 (default invalido 'NULL')
-- default descartado: tablas_varias.valor5 (default invalido 'NULL')
-- default descartado: tab_cartola_bco.hora (default invalido 'NULL')
-- default descartado: tab_cartola_bco.rut (default invalido 'NULL')
-- default descartado: tab_cartola_bco.ctacte (default invalido 'NULL')
-- default descartado: tab_cartola_bco.numdoc (default invalido 'NULL')
-- default descartado: tab_cartola_bco.banco (default invalido 'NULL')
-- default descartado: tab_cartola_bco.fec_estado (default invalido 'NULL')
-- default descartado: tab_cartola_bco.id_pago (default invalido 'NULL')
-- default descartado: tab_cartola_bco.tipo_ref (default invalido 'NULL')
-- default descartado: tab_cartola_bco.cliente (default invalido 'NULL')
-- default descartado: tab_lista_explode.cliente (default invalido 'NULL')
-- default descartado: tab_lista_explode.numdoc (default invalido 'NULL')
-- default descartado: usuarios.usr_fini (default invalido '0000-00-00 00:00:00')
-- default descartado: valores_economicos.glosa (default invalido 'NULL')
-- default descartado: valores_economicos.valor2 (default invalido 'NULL')
-- default descartado: vehiculos.propio (default invalido 'NULL')
-- default descartado: vehiculos.nombre_own (default invalido 'NULL')
-- default descartado: vehiculos.id_mov (default invalido 'NULL')

CREATE TYPE acceso_funciones_acc_tipo_enum AS ENUM ('MENU', 'OPCION', 'FUNCION', 'OTRO');
CREATE TYPE acceso_perfiles_per_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO');
CREATE TYPE acceso_permisos_per_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO');
CREATE TYPE adm_bancos_estado_enum AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE base_digital_tipo_enum AS ENUM ('DOC_REC', 'DOC_EMI', 'VHE', 'EQUIPOS', 'DOC_GRAL', 'CONTRATO', 'PROYECTO', 'CLIENTES', 'BODEGA', 'PAGOS', 'TICKET', 'KARIN', 'PERSONAL', 'PERSONAL_QR', 'MATERIALES', '');
CREATE TYPE base_digital_estado_enum AS ENUM ('ACTIVO', 'ANULADO', 'ELIMINADO');
CREATE TYPE bodega_estado_enum AS ENUM ('VIGENTE', 'NO VIGENTE');
CREATE TYPE categorias_tipo_enum AS ENUM ('CAT', 'SUB', 'IND', 'IND_ANULA');
CREATE TYPE centro_costo_estado_enum AS ENUM ('VIGENTE', 'NO VIGENTE', 'ABIERTO', 'CERRADO');
CREATE TYPE data_cheques_tipo_enum AS ENUM ('CHEQUE', 'TRANSF');
CREATE TYPE data_cheques_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO', 'COBRADO');
CREATE TYPE data_clientes_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO', 'BAJA');
CREATE TYPE data_clientes_tipo_reg_enum AS ENUM ('CLI', 'PRO', 'CLPRO');
CREATE TYPE data_clientes_bco_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO');
CREATE TYPE data_clientes_cargos_estado_enum AS ENUM ('ACTIVO', 'PAGADO', 'ANULADO');
CREATE TYPE data_clientes_cheques_estado_enum AS ENUM ('ACTIVO', 'ANULADO', 'COBRADO', 'DEVUELTO', 'ABASTIBLE', 'PAGO ABAST', 'TEMPORAL');
CREATE TYPE data_clientes_factura_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO', 'BAJA');
CREATE TYPE data_clientes_sucursal_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO');
CREATE TYPE data_personal_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO', 'BAJA');
CREATE TYPE data_personal_funcion_enum AS ENUM ('NA', 'CHOFER', 'ADMIN', 'VTA_EMP', 'LOCAL', 'OTRO');
CREATE TYPE data_personal_incentivo_enum AS ENUM ('SI', 'NO', '');
CREATE TYPE data_personal_anticipo_enum AS ENUM ('SI', 'NO');
CREATE TYPE data_personal_afecto_trans_enum AS ENUM ('SI', 'NO');
CREATE TYPE data_personal_afecto_turnos_enum AS ENUM ('SI', 'NO', '');
CREATE TYPE data_personal_rol_enum AS ENUM ('GENERAL', 'JEFATURA', '');
CREATE TYPE depositos_estado_enum AS ENUM ('PENDIENTE', 'ACEPTADO', 'ANULADO');
CREATE TYPE docs_emitidos_tipo_nc_enum AS ENUM ('', 'ANULA', 'ADMINISTRATIVA', 'MONTOS');
CREATE TYPE docs_emitidos_tipo_cli_enum AS ENUM ('CLIENTE', 'PROVEEDOR');
CREATE TYPE docs_emitidos_estado_enum AS ENUM ('EMITIDO', 'CERRADO', 'SALDO_PAGO', 'ANULADO', 'ELIMINADO', 'PAGO', 'PENDIENTE', '');
CREATE TYPE docs_emitidos_frmpago_enum AS ENUM ('CONTADO', 'CREDITO', 'SIN COSTO', '');
CREATE TYPE docs_emitidos_guia_tipo_despacho_enum AS ENUM ('', 'RECEPTOR', 'EMISOR', 'OTROS');
CREATE TYPE docs_emitidos_guia_forma_pago_enum AS ENUM ('', 'CONTADO', 'CREDITO', 'SIN COSTO');
CREATE TYPE docs_emitidos_guia_estado_enum AS ENUM ('', 'ABIERTA', 'PROCESO', 'CERRADA', 'ANULADO');
CREATE TYPE docs_emitidos_tipo_moneda_enum AS ENUM ('CLP', 'UF', 'DOLAR', 'EURO', 'UTM', '');
CREATE TYPE docs_pagos_tipo_enum AS ENUM ('EMITIDO', 'RECIBIDO');
CREATE TYPE docs_pagos_estado_enum AS ENUM ('ACTIVO', 'ANULADO', 'PENDIENTE');
CREATE TYPE docs_recibidos_tipo_nc_enum AS ENUM ('', 'ANULA', 'ADMINISTRATIVA', 'REBAJA');
CREATE TYPE docs_recibidos_tipo_cli_enum AS ENUM ('CLIENTE', 'PROVEEDOR', '');
CREATE TYPE docs_recibidos_estado_enum AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'CERRADO', 'SALDO_PAGO', 'ANULADO', 'DISTRIBUIDO', 'PAGO');
CREATE TYPE docs_recibidos_frmpago_enum AS ENUM ('CONTADO', 'CREDITO', 'SIN COSTO');
CREATE TYPE docs_recibidos_guia_tipo_despacho_enum AS ENUM ('', 'RECEPTOR', 'EMISOR', 'OTROS');
CREATE TYPE docs_recibidos_guia_forma_pago_enum AS ENUM ('', 'CONTADO', 'CREDITO', 'SIN COSTO');
CREATE TYPE docs_recibidos_guia_estado_enum AS ENUM ('', 'ABIERTA', 'PROCESO', 'CERRADA', 'ANULADO');
CREATE TYPE docs_recibidos_tipo_moneda_enum AS ENUM ('CLP', '');
CREATE TYPE empresa_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO');
CREATE TYPE herramientas_tipo_enum AS ENUM ('EQUIPO', 'HERRAMIENTA', 'Equipos C&P', 'Equipos de Bloqueo', 'Insumos de Terreno', 'Insumos IIFF', 'Equipos de Terreno', 'Equipamiento Linea', 'Equipamiento LLVV', 'Equipos informaticos', 'Cajas de Herramientas', 'KIT de rescate', 'Equip Insp Visual', 'Prevencion');
CREATE TYPE herramientas_estado_enum AS ENUM ('Alta', 'Baja', 'Faltante');
CREATE TYPE herramientas_tipocertificacion_enum AS ENUM ('INTERNA', 'EXTERNA', '');
CREATE TYPE herramientas_tipocalibracion_enum AS ENUM ('INTERNA', 'EXTERNA', '');
CREATE TYPE herramientas_propiosvaips_enum AS ENUM ('SI', 'NO', '');
CREATE TYPE herramientas_situacion_enum AS ENUM ('Vigente', 'Faltante', 'Baja', 'Vencido', 'No Disponible');
CREATE TYPE herramientas_intervencion_enum AS ENUM ('Sin Intervención', 'Calibración', 'Verificación', '');
CREATE TYPE lugar_trabajo_region_enum AS ENUM ('Arica y Parinacota', 'Tarapacá', 'Antofagasta', 'Atacama', 'Coquimbo', 'Valparaíso', 'Metropolitana', 'Libertador General Bernardo O''Higgins', 'Maule', 'Ñuble', 'Biobío', 'La Araucanía', 'Los Ríos', 'Los Lagos', 'Aysén', 'Magallanes');
CREATE TYPE lugar_trabajo_tipo_enum AS ENUM ('Sub-Estación', 'Linea de Trabajo');
CREATE TYPE materiales_tipo_enum AS ENUM ('MATERIAL');
CREATE TYPE materiales_estado_enum AS ENUM ('Alta', 'Baja');
CREATE TYPE mov_bodega_tipo_mov_enum AS ENUM ('IN', 'OUT', '');
CREATE TYPE mov_bodega_tipo_vhe_enum AS ENUM ('Vehiculo', 'Herramientas', 'Equipo', 'Equipos C&P', 'Equipos de Bloqueo', 'Insumos de Terreno', 'Material', 'Equipamiento LLVV', 'Cajas de Herramientas', 'Equipamiento Linea', 'Equip Insp Visual', 'Insumos IIFF', 'KIT de rescate', 'Prevencion', '');
CREATE TYPE pagos_estado_enum AS ENUM ('SOLICITUD', 'ACEPTADO', 'PAGADO', 'RECHAZADO', '');
CREATE TYPE registro_tipo_accion_enum AS ENUM ('MOD_REG', 'INS_REG', 'DEL_REG', 'LOGIN', 'LOGOUT', 'UPD_PEDIDO', 'EXEC_PROC', 'GEN_BD', 'INS/UPD_REG', 'TIMEOUT', '');
CREATE TYPE rinde_gastos_estado_enum AS ENUM ('PENDIENTE', 'CERRADO');
CREATE TYPE rrhh_cargos_categoria_enum AS ENUM ('ADMINISTRACION', 'TERRENO');
CREATE TYPE rrhh_cargos_estado_enum AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE sot_presupuesto_zona_enum AS ENUM ('Centro', 'Norte', 'Sur', 'Centro-Sur');
CREATE TYPE sot_presupuesto_estado_enum AS ENUM ('Borrador', 'Emitido', 'Observado', 'Aprobado', 'Rechazado', 'Anulado');
CREATE TYPE sot_presupuesto_cargo_estado_enum AS ENUM ('ACTIVO', 'INACTIVO');
CREATE TYPE sot_trabajo_zona_enum AS ENUM ('Centro', 'Norte', 'Sur', 'Centro-Sur');
CREATE TYPE sot_trabajo_area_enum AS ENUM ('Sub-estaciones', 'Lineas', 'Control', '');
CREATE TYPE sot_trabajo_tipo_enum AS ENUM ('Planificado', 'No planificado');
CREATE TYPE sot_trabajo_tipo_mantenimiento_enum AS ENUM ('MCC', 'MPB', 'CURSO FORZOSO', 'FALLA', 'OTRO', '');
CREATE TYPE sot_trabajo_estado_enum AS ENUM ('Planificacion', 'AT', 'Ejecucion', 'Entrega', 'Estado de Pago', 'Facturacion');
CREATE TYPE tablas_varias_tipo_enum AS ENUM ('VACIO', 'ISAPRE', 'AFP', 'OFICINAS', 'CARGO', 'BODEGA', 'BANCO', 'TIPO PAGO', 'CARGA_FAM', 'INDICE_PERSONAL', 'TAB_IMPTO', 'SUPERVISOR', 'PANEL_CTRL', 'SII_TPO_VENTA', 'SII_TPO_COMPRA', 'SII_FMA_PAGO', 'TIPO_DOC', 'PRESUPUESTO', 'SII_TPO_DESPACHO', 'SII_TRASLADO', 'DOCS_PROY', 'UNIDAD', 'PROVEEDOR_VEH', 'INFO_CONTRATO', 'TIPO_ADJUNTO', 'CATEGORIAS', 'FERIADOS', 'RRHH_AMBITO', 'RRHH_CATEGORIA');
CREATE TYPE tab_cartola_bco_estado_enum AS ENUM ('INGRESADO', 'CUADRADO', 'ANULADO');
CREATE TYPE usuarios_usr_estado_enum AS ENUM ('ACTIVO', 'INACTIVO', 'ELIMINADO');
CREATE TYPE usuarios_usr_tipo_enum AS ENUM ('OPERADOR', 'ADMINISTRADOR', 'CONSULTA', '');
CREATE TYPE valores_economicos_tipo_param_enum AS ENUM ('UTM', 'UF', 'DOLAR', 'CLP', 'EURO');
CREATE TYPE vehiculos_estado_enum AS ENUM ('ACTIVO', 'BAJA');
CREATE TYPE vehiculos_tipo_enum AS ENUM ('CAMION', 'CAMIONETA', 'AUTO', 'MINICARGADOR', 'RETROEXCAVADORA', 'CARRO');
CREATE TYPE vehiculos_propio_enum AS ENUM ('ARRIENDO', 'VAIPS', '');

CREATE TABLE "acceso_funciones" (
  "acc_id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "acc_tipo" acceso_funciones_acc_tipo_enum NOT NULL,
  "acc_glosa" varchar(30) NOT NULL,
  "acc_padre" integer NOT NULL,
  "acc_fini" date,
  "acc_ffin" date,
  "acc_estado" varchar(20) NOT NULL,
  "acc_descripcion" text,
  PRIMARY KEY ("acc_id")
);

CREATE TABLE "acceso_perfiles" (
  "per_id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "per_glosa" varchar(30) NOT NULL,
  "url_inicio" varchar(100),
  "per_fini" date,
  "per_ffin" date,
  "per_estado" acceso_perfiles_per_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  PRIMARY KEY ("per_id")
);

CREATE TABLE "acceso_permisos" (
  "per_id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "per_perfil" integer NOT NULL,
  "per_func" integer NOT NULL,
  "per_estado" acceso_permisos_per_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  "per_fecha" date NOT NULL,
  PRIMARY KEY ("per_id")
);

CREATE TABLE "adm_bancos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "banco" integer NOT NULL,
  "ctacte" integer NOT NULL,
  "folio_ini" integer NOT NULL,
  "folio_fin" integer NOT NULL,
  "folio_actual" integer NOT NULL,
  "estado" adm_bancos_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "base_digital" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "tipo" base_digital_tipo_enum DEFAULT 'DOC_GRAL' NOT NULL,
  "id_ref01" varchar(20) NOT NULL,
  "id_ref02" varchar(20) NOT NULL,
  "id_ref03" varchar(20) NOT NULL,
  "id_ref04" varchar(20) NOT NULL,
  "tipo_adjunto" varchar(50) NOT NULL,
  "rut_cliente" varchar(15) NOT NULL,
  "fecha_ing" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "fecha" date NOT NULL,
  "fecha_vigencia" date NOT NULL,
  "id_padre" varchar(20) NOT NULL,
  "titulo" varchar(40) NOT NULL,
  "descripcion" varchar(512) NOT NULL,
  "filename" varchar(100) NOT NULL,
  "filetype" varchar(100) NOT NULL,
  "nombre_archivo" varchar(100) NOT NULL,
  "estado" base_digital_estado_enum DEFAULT 'ACTIVO',
  "user" varchar(20) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "bodega" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "bodega" varchar(30) NOT NULL,
  "descr" varchar(50) NOT NULL,
  "estado" bodega_estado_enum NOT NULL,
  "ccosto" varchar(50) NOT NULL,
  "fecha_ingreso" date NOT NULL,
  "id_responsable" integer NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "cambia_pw" (
  "pw_id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "pw_fecha" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "pw_secuencia" varchar(50) NOT NULL,
  "pw_user" varchar(20) NOT NULL,
  "pw_IP" varchar(20) NOT NULL,
  "pw_mail" varchar(100) NOT NULL,
  "pw_estado" varchar(20) NOT NULL,
  PRIMARY KEY ("pw_id")
);

CREATE TABLE "categorias" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "tipo" categorias_tipo_enum NOT NULL,
  "padre" integer NOT NULL,
  "codigo" varchar(15) NOT NULL,
  "glosa" varchar(30) NOT NULL,
  "unidad" varchar(10) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "centro_costo" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "ccosto" varchar(50) NOT NULL,
  "cliente" integer NOT NULL,
  "id_sucursal" integer NOT NULL,
  "proyecto" varchar(50) NOT NULL,
  "fini" date NOT NULL,
  "ffin" date NOT NULL,
  "presupuesto" numeric(10,2) NOT NULL,
  "presupuesto_neto" numeric(10,2) NOT NULL,
  "estado" centro_costo_estado_enum DEFAULT 'VIGENTE' NOT NULL,
  "id_responsable" smallint NOT NULL,
  "grupo_01" smallint NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "comunas" (
  "com_id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "com_glosa" varchar(20) NOT NULL,
  "provincia" varchar(23) NOT NULL,
  "region" varchar(45) NOT NULL,
  PRIMARY KEY ("com_id")
);

CREATE TABLE "data_cheques" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "ref_doc" integer NOT NULL,
  "numdoc" integer NOT NULL,
  "monto" integer NOT NULL,
  "fecha" timestamp NOT NULL,
  "fec_venc" date NOT NULL,
  "banco" integer NOT NULL,
  "cheque" varchar(20) NOT NULL,
  "ctacte" varchar(20) NOT NULL,
  "tipo" data_cheques_tipo_enum DEFAULT 'CHEQUE' NOT NULL,
  "estado" data_cheques_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "data_clientes" (
  "codigo" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "rut" varchar(15),
  "nombre" varchar(50) NOT NULL,
  "apellido" varchar(50) NOT NULL,
  "direcc" varchar(50) NOT NULL,
  "comuna" integer NOT NULL,
  "ciudad" varchar(30),
  "fono" integer DEFAULT 0,
  "celular" integer DEFAULT 0,
  "email" varchar(50),
  "estado" data_clientes_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  "contacto" varchar(30),
  "dias_plazo_pago" smallint DEFAULT 30,
  "bco_direcc" varchar(50),
  "bco_comuna" integer,
  "bco_fono" varchar(15),
  "categoria" varchar(20),
  "factura_dias_pago" smallint DEFAULT 5,
  "tipo_reg" data_clientes_tipo_reg_enum DEFAULT 'CLI' NOT NULL,
  "fingreso" date,
  "codigo_cc" integer,
  PRIMARY KEY ("codigo")
);

CREATE TABLE "data_clientes_bco" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "cliente" integer,
  "ctacte" varchar(50),
  "banco" integer,
  "rut" varchar(20) NOT NULL,
  "principal" smallint DEFAULT 1 NOT NULL,
  "estado" data_clientes_bco_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "data_clientes_cargos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "periodo" varchar(7) NOT NULL,
  "codigo" integer NOT NULL,
  "fecha" timestamp NOT NULL,
  "monto" integer NOT NULL,
  "obs" text,
  "estado" data_clientes_cargos_estado_enum NOT NULL,
  "fecha_pago" timestamp,
  "num_pago" integer,
  PRIMARY KEY ("id")
);

CREATE TABLE "data_clientes_cheques" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "id_vta" integer NOT NULL,
  "cliente" integer NOT NULL,
  "tipo_pago" smallint NOT NULL,
  "banco" integer NOT NULL,
  "ctacte" varchar(20) NOT NULL,
  "cheque" varchar(20) NOT NULL,
  "monto" integer NOT NULL,
  "fec_venc" date NOT NULL,
  "fec_cobro" date NOT NULL,
  "estado" data_clientes_cheques_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  "fec_deposito" date,
  "num_deposito" integer,
  "bco_deposito" smallint,
  "fec_protesto" date,
  "num_protesto" integer,
  "id_deposito" integer,
  PRIMARY KEY ("id")
);

CREATE TABLE "data_clientes_factura" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "codigo" integer NOT NULL,
  "distribuidor" integer,
  "rut" varchar(15),
  "razon" varchar(50),
  "giro" varchar(50),
  "direcc" varchar(50),
  "comuna" integer,
  "ciudad" varchar(30),
  "fono" integer,
  "email" varchar(50),
  "estado" data_clientes_factura_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  "contacto" varchar(30),
  PRIMARY KEY ("id")
);

CREATE TABLE "data_clientes_sucursal" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "cliente" integer,
  "sucursal" varchar(50) NOT NULL,
  "direccion" varchar(50) NOT NULL,
  "comuna" integer NOT NULL,
  "ciudad" varchar(30) NOT NULL,
  "fono" integer NOT NULL,
  "celular" integer NOT NULL,
  "email" varchar(50) NOT NULL,
  "contacto" varchar(30) NOT NULL,
  "estado" data_clientes_sucursal_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "data_personal" (
  "codigo" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "rut" varchar(15),
  "nombre" varchar(50) NOT NULL,
  "apellido" varchar(50) NOT NULL,
  "materno" varchar(30) NOT NULL,
  "direcc" varchar(50) NOT NULL,
  "comuna" integer NOT NULL,
  "ciudad" varchar(30),
  "fono" integer DEFAULT 0,
  "celular" integer DEFAULT 0,
  "email" varchar(50),
  "estado" data_personal_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  "contacto" varchar(30),
  "fingreso" date NOT NULL,
  "sucursal" smallint NOT NULL,
  "categoria" smallint NOT NULL,
  "cargo" smallint NOT NULL,
  "area" smallint NOT NULL,
  "ubicacion" smallint NOT NULL,
  "funcion" data_personal_funcion_enum DEFAULT 'NA' NOT NULL,
  "sueldo_base" integer NOT NULL,
  "salud" smallint NOT NULL,
  "UF_salud" numeric(10,4) NOT NULL,
  "afp" smallint NOT NULL,
  "incentivo" data_personal_incentivo_enum DEFAULT 'NO' NOT NULL,
  "anticipo" data_personal_anticipo_enum DEFAULT 'NO' NOT NULL,
  "dia_anticipo" smallint NOT NULL,
  "afecto_trans" data_personal_afecto_trans_enum DEFAULT 'NO' NOT NULL,
  "afecto_turnos" data_personal_afecto_turnos_enum DEFAULT 'NO' NOT NULL,
  "ccosto" varchar(50) NOT NULL,
  "disponible1" integer NOT NULL,
  "disponible2" integer NOT NULL,
  "evaluador_id" integer DEFAULT 0 NOT NULL,
  "calibrador_id" integer DEFAULT 0 NOT NULL,
  "rol" data_personal_rol_enum DEFAULT 'GENERAL' NOT NULL,
  PRIMARY KEY ("codigo")
);

CREATE TABLE "depositos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "banco" smallint NOT NULL,
  "fecha" date NOT NULL,
  "numero" integer NOT NULL,
  "bodega" integer,
  "n_docs" smallint,
  "cheques_id" varchar(512),
  "tot_docs" integer,
  "efectivo" integer,
  "fecha_efectivo" date,
  "total" integer NOT NULL,
  "estado" depositos_estado_enum DEFAULT 'PENDIENTE' NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "docs_emitidos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "numdoc" integer,
  "tipo_doc" varchar(5) NOT NULL,
  "tipo_NC" docs_emitidos_tipo_nc_enum,
  "fecha" timestamp,
  "cliente" integer,
  "rut" varchar(15),
  "tipo_cli" docs_emitidos_tipo_cli_enum DEFAULT 'CLIENTE' NOT NULL,
  "estado" docs_emitidos_estado_enum DEFAULT 'EMITIDO',
  "FrmPago" docs_emitidos_frmpago_enum DEFAULT 'CONTADO',
  "TpoVenta" smallint,
  "total" integer,
  "neto" integer,
  "iva" integer,
  "ref_num" integer,
  "ref_tipo" varchar(5),
  "ref_fecha" date DEFAULT '1900-01-01',
  "ref_id" integer,
  "guia_ind_traslado" integer,
  "guia_tipo_despacho" docs_emitidos_guia_tipo_despacho_enum DEFAULT '',
  "guia_forma_pago" docs_emitidos_guia_forma_pago_enum DEFAULT '',
  "guia_estado" docs_emitidos_guia_estado_enum DEFAULT '',
  "guia_patente" varchar(10),
  "guia_rut_transporte" varchar(15),
  "guia_direcc" varchar(50),
  "guia_comuna" varchar(20),
  "guia_ciudad" varchar(20),
  "contacto" varchar(50) NOT NULL,
  "dir_retiro" varchar(100) NOT NULL,
  "dat_ref" varchar(100),
  "obs" varchar(1024),
  "url_PDF" text,
  "url_XML" text,
  "factura" integer NOT NULL,
  "OC" varchar(30),
  "OC_fecha" date,
  "HES" varchar(30),
  "HES_fecha" date,
  "bodega" integer,
  "ccosto" varchar(50) NOT NULL,
  "OC_avance" numeric(8,4) DEFAULT 0.0000 NOT NULL,
  "tipo_moneda" docs_emitidos_tipo_moneda_enum DEFAULT 'CLP' NOT NULL,
  "tipo_cambio" numeric(10,4) DEFAULT 1.0000 NOT NULL,
  "fecha_moneda" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "usuario" varchar(20),
  PRIMARY KEY ("id")
);

CREATE TABLE "docs_emitidos_detalle" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "numdoc" integer,
  "tipo_doc" varchar(5) NOT NULL,
  "cliente" integer DEFAULT 0 NOT NULL,
  "producto" varchar(20),
  "cantidad" numeric(10,2),
  "unidad" varchar(20) DEFAULT 'KG',
  "precio_uni" numeric(15,2),
  "descto" numeric(15,2),
  "total" numeric(10,2) NOT NULL,
  "OC_avance" numeric(8,4) DEFAULT 0.0000,
  "nombre" varchar(80) NOT NULL,
  "descripcion" varchar(512) NOT NULL,
  "comentario" varchar(500),
  "ccosto" varchar(50) NOT NULL,
  "ccosto_ap" varchar(30) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "docs_emitidos_plan_pago" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "id_doc" integer NOT NULL,
  "fecha" date NOT NULL,
  "monto" integer NOT NULL,
  "glosa" varchar(40) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "docs_pagos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "tipo" docs_pagos_tipo_enum DEFAULT 'RECIBIDO' NOT NULL,
  "ref_id_doc" integer NOT NULL,
  "fecha_ing" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "cliente" integer NOT NULL,
  "tipo_pago" smallint NOT NULL,
  "numdoc" integer NOT NULL,
  "monto" integer NOT NULL,
  "saldo" integer NOT NULL,
  "fecha_pago" date NOT NULL,
  "fec_venc" date,
  "banco" integer,
  "num_cheque" varchar(50),
  "num_ctacte" varchar(20),
  "estado" docs_pagos_estado_enum DEFAULT 'ACTIVO',
  "usuario" varchar(20) DEFAULT 'admin',
  PRIMARY KEY ("id")
);

CREATE TABLE "docs_pagos_fac" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "id_pago" integer NOT NULL,
  "id_fac" integer NOT NULL,
  "cliente" integer,
  "total_pago" integer,
  "total_fac" integer,
  "fecha" varchar(10),
  PRIMARY KEY ("id")
);

CREATE TABLE "docs_recibidos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "numdoc" integer,
  "tipo_doc" varchar(5) NOT NULL,
  "fecha_ing" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "tipo_NC" docs_recibidos_tipo_nc_enum,
  "fecha" timestamp,
  "cliente" integer,
  "rut" varchar(15),
  "tipo_cli" docs_recibidos_tipo_cli_enum DEFAULT 'CLIENTE' NOT NULL,
  "estado" docs_recibidos_estado_enum DEFAULT 'PENDIENTE',
  "FrmPago" docs_recibidos_frmpago_enum DEFAULT 'CONTADO',
  "total" numeric(15,2),
  "neto" numeric(15,2),
  "iva" numeric(10,2),
  "impto_adic" numeric(10,2) NOT NULL,
  "tipo_impto" numeric(5,2) NOT NULL,
  "ref_num" integer,
  "ref_tipo" varchar(5),
  "ref_fecha" date DEFAULT '1900-01-01',
  "guia_ind_traslado" integer,
  "guia_tipo_despacho" docs_recibidos_guia_tipo_despacho_enum,
  "guia_forma_pago" docs_recibidos_guia_forma_pago_enum,
  "guia_estado" docs_recibidos_guia_estado_enum,
  "guia_patente" varchar(10),
  "guia_rut_transporte" varchar(15),
  "guia_direcc" varchar(50),
  "guia_comuna" varchar(20),
  "guia_ciudad" varchar(20),
  "obs" varchar(1024),
  "url_PDF" text,
  "url_XML" text,
  "OC" varchar(20),
  "OC_fecha" date,
  "HES" varchar(20),
  "HES_fecha" date,
  "bodega" integer,
  "ccosto" varchar(50) NOT NULL,
  "OC_avance" smallint DEFAULT 0 NOT NULL,
  "tipo_moneda" docs_recibidos_tipo_moneda_enum DEFAULT 'CLP' NOT NULL,
  "tipo_cambio" integer DEFAULT 1 NOT NULL,
  "fecha_moneda" date DEFAULT '2020-01-01' NOT NULL,
  "usuario" varchar(20) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "docs_recibidos_detalle" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "numdoc" integer,
  "tipo_doc" varchar(5) NOT NULL,
  "cliente" integer NOT NULL,
  "producto" varchar(20),
  "cantidad" numeric(10,3),
  "unidad" varchar(20) DEFAULT 'KG',
  "precio_uni" numeric(15,4),
  "descto" numeric(15,4),
  "impto_adic" numeric(10,2) NOT NULL,
  "IndExe" smallint DEFAULT 0 NOT NULL,
  "total" integer NOT NULL,
  "OC_avance" smallint DEFAULT 0,
  "nombre" varchar(80) NOT NULL,
  "descripcion" varchar(512) NOT NULL,
  "ccosto" varchar(50) NOT NULL,
  "ccosto_ap" varchar(30),
  PRIMARY KEY ("id")
);

CREATE TABLE "empresa" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "rut" char(10) DEFAULT '' NOT NULL,
  "razon" char(80) DEFAULT '' NOT NULL,
  "giro" varchar(100) NOT NULL,
  "direcc" char(100) DEFAULT '' NOT NULL,
  "comuna" varchar(30) NOT NULL,
  "ciudad" char(25) DEFAULT '' NOT NULL,
  "acteto" varchar(20) NOT NULL,
  "estado" empresa_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "herramientas" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "Tipo" herramientas_tipo_enum NOT NULL,
  "Cod_equipo" varchar(20) NOT NULL,
  "Nom_equipo" varchar(30),
  "Serie" varchar(30),
  "estado" herramientas_estado_enum NOT NULL,
  "certificado" varchar(10),
  "asigna" varchar(20) NOT NULL,
  "tipoCertificacion" herramientas_tipocertificacion_enum,
  "frecuenciaCertificacion" smallint,
  "Ult_certificacion" date,
  "tipoCalibracion" herramientas_tipocalibracion_enum,
  "frecuenciaCalibracion" smallint,
  "Ult_calibracion" date,
  "Marca" varchar(30),
  "Modelo" varchar(30),
  "propiosVaips" herramientas_propiosvaips_enum,
  "Comentario" varchar(40),
  "Ubicacion" varchar(20),
  "ccosto_ap" varchar(30) NOT NULL,
  "tarifa_1" integer DEFAULT 0 NOT NULL,
  "tarifa_2" integer DEFAULT 0 NOT NULL,
  "id_bodega" integer NOT NULL,
  "id_mov" integer NOT NULL,
  "stock" integer NOT NULL,
  "situacion" herramientas_situacion_enum DEFAULT 'Vigente' NOT NULL,
  "intervencion" herramientas_intervencion_enum DEFAULT 'Sin Intervención' NOT NULL,
  "accion" varchar(150) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "lugar_trabajo" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "nombre" varchar(200) NOT NULL,
  "region" lugar_trabajo_region_enum NOT NULL,
  "owner" integer,
  "tipo" lugar_trabajo_tipo_enum NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "materiales" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "Tipo" materiales_tipo_enum NOT NULL,
  "cod_material" varchar(20) NOT NULL,
  "nombre" varchar(80),
  "estado" materiales_estado_enum NOT NULL,
  "unidad" smallint,
  "ccosto_ap" varchar(30) NOT NULL,
  "tarifa" numeric(10,2) DEFAULT 0.00 NOT NULL,
  "stock_minimo" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "materiales_x_bodega" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "cod_material" varchar(20) NOT NULL,
  "id_bodega" integer NOT NULL,
  "stock" integer NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "mov_bodega" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "numdoc" integer,
  "tipoDoc" varchar(10),
  "id_bodega" integer NOT NULL,
  "id_responsable" integer,
  "tipo_mov" mov_bodega_tipo_mov_enum NOT NULL,
  "fecha" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "fechaFin" date NOT NULL,
  "ccosto" varchar(50) NOT NULL,
  "tarifa" integer NOT NULL,
  "ccosto_ap" varchar(30) NOT NULL,
  "tipo_vhe" mov_bodega_tipo_vhe_enum NOT NULL,
  "id_vhe" varchar(30) NOT NULL,
  "cantidad" integer DEFAULT 1 NOT NULL,
  "unidad" varchar(20) NOT NULL,
  "estado" varchar(300) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "pagos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "cliente" integer NOT NULL,
  "fecha_ing" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "tipodoc" varchar(20) NOT NULL,
  "numdoc" integer NOT NULL,
  "id_fac" integer NOT NULL,
  "monto" integer NOT NULL,
  "porc_cobro" numeric(10,1) NOT NULL,
  "monto_cobro" integer NOT NULL,
  "lote_pago" integer,
  "estado" pagos_estado_enum DEFAULT 'SOLICITUD' NOT NULL,
  "fecha_valida" timestamp,
  "user_valida" varchar(20),
  "fecha_confirma_pago" timestamp,
  "user_confirma" varchar(20),
  "obs" text NOT NULL,
  "ctacte" varchar(30) NOT NULL,
  "banco" smallint NOT NULL,
  "rut_ctacte" varchar(20) NOT NULL,
  "id_transaccion" varchar(30) NOT NULL,
  "fecha_tran" date NOT NULL,
  "user_ing" varchar(20) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "parametros" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "nombre" varchar(50) NOT NULL,
  "valor" numeric(16,6) NOT NULL,
  "descripcion" varchar(250) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "protocolos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "tipo" varchar(80) NOT NULL,
  "nombre" varchar(80) NOT NULL,
  "archivo" varchar(80) NOT NULL,
  "fecha" date NOT NULL,
  "estado" integer NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "registro" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "fecha" timestamp NOT NULL,
  "usuario" varchar(15) NOT NULL,
  "tipo_accion" registro_tipo_accion_enum NOT NULL,
  "tabla_accion" varchar(30),
  "id_registro" integer,
  "inf_1" varchar(500),
  "inf_2" varchar(200),
  "qstring" text NOT NULL,
  "IP" varchar(15) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "registro_error" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "fecha" timestamp NOT NULL,
  "usuario" varchar(15) NOT NULL,
  "mesg" text NOT NULL,
  "data" text NOT NULL,
  "IP" varchar(15) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "rinde_gastos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "usr_rinde" varchar(20) NOT NULL,
  "usr_reporte" varchar(20) NOT NULL,
  "fecha_reporte" date NOT NULL,
  "fecha_ingreso" date NOT NULL,
  "ccosto" varchar(50) NOT NULL,
  "ccosto_ap" varchar(10) NOT NULL,
  "fecha_gasto" date NOT NULL,
  "rut_proveedor" varchar(15),
  "tipo_doc" varchar(30) NOT NULL,
  "cod_tipo_doc" varchar(5),
  "numdoc" bigint NOT NULL,
  "categoria" varchar(20),
  "subCategoria" varchar(20),
  "indicador" varchar(20),
  "descripcion" varchar(150) NOT NULL,
  "neto" numeric(15,4) NOT NULL,
  "iva" numeric(15,4) NOT NULL,
  "total" numeric(15,4) NOT NULL,
  "URL_informe" text,
  "URL_Boleta" text,
  "estado" rinde_gastos_estado_enum,
  PRIMARY KEY ("id")
);

CREATE TABLE "rrhh_areas" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "descripcion" varchar(100) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "rrhh_cargos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "descripcion" varchar(80) NOT NULL,
  "categoria" rrhh_cargos_categoria_enum DEFAULT 'ADMINISTRACION' NOT NULL,
  "estado" rrhh_cargos_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "rrhh_ubicacion" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "descripcion" varchar(50) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_at" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "numero_at" varchar(50) NOT NULL,
  "trabajo_id" integer NOT NULL,
  "inicio" timestamp,
  "fin" timestamp,
  "ganancia_potencial" numeric(14,3),
  "cantidad_informes" integer DEFAULT 0 NOT NULL,
  "hh_utilizadas" numeric(10,2),
  "costo_estimado_actividad" numeric(12,2),
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_at_herramienta" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "at_id" integer NOT NULL,
  "herramienta_id" integer NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_at_om" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "at_id" integer NOT NULL,
  "orden_mantenimiento" varchar(50) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_at_personal" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "at_id" integer NOT NULL,
  "personal_codigo" integer NOT NULL,
  "cargo_id" integer DEFAULT 1 NOT NULL,
  "costo_hh" numeric(10,2),
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_at_vehiculo" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "at_id" integer NOT NULL,
  "vehiculo_id" integer NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_entregable" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "trabajo_id" integer NOT NULL,
  "tipo" varchar(100),
  "nombre" varchar(255) NOT NULL,
  "fecha_inicio" date,
  "fecha_entrega" date,
  "archivo_url" varchar(500),
  "responsable_codigo" integer,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_equipo" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "nombre" varchar(120) NOT NULL,
  "lugar_trabajo_id" integer NOT NULL,
  "tipo" varchar(10),
  "subtipo" varchar(12),
  "kv" varchar(10),
  "letra" char(1),
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_informe" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "at_id" integer NOT NULL,
  "numero" varchar(50),
  "nombre" varchar(255) NOT NULL,
  "archivo_url" varchar(500) NOT NULL,
  "subido_en" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_presupuesto" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "numero_solicitud" varchar(30) NOT NULL,
  "revision" integer DEFAULT 0 NOT NULL,
  "origen_id" integer,
  "zona" sot_presupuesto_zona_enum NOT NULL,
  "region" varchar(200) NOT NULL,
  "cuenta_cargo_at" varchar(50),
  "fecha_solicitud" date NOT NULL,
  "fecha_ejecucion" date,
  "valor_uf" numeric(15,2) NOT NULL,
  "descripcion" text NOT NULL,
  "alojamiento" text,
  "observaciones" text,
  "aclaraciones" text,
  "estado" sot_presupuesto_estado_enum DEFAULT 'Borrador' NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_presupuesto_cargo" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "descripcion" varchar(80) NOT NULL,
  "unidad" varchar(20) NOT NULL,
  "tarifa" numeric(10,3) NOT NULL,
  "estado" sot_presupuesto_cargo_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_presupuesto_herramienta" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "presupuesto_id" integer NOT NULL,
  "herramienta_id" integer NOT NULL,
  "cantidad" numeric(10,2) NOT NULL,
  "tarifa" numeric(12,2) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_presupuesto_material" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "presupuesto_id" integer NOT NULL,
  "tipo" varchar(30),
  "descripcion" varchar(200) NOT NULL,
  "unidad" varchar(20),
  "precio_unitario" numeric(12,2) NOT NULL,
  "cantidad" numeric(10,2) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_presupuesto_personal" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "presupuesto_id" integer NOT NULL,
  "personal_codigo" integer NOT NULL,
  "cargo_id" integer NOT NULL,
  "cantidad" numeric(10,2) NOT NULL,
  "tarifa" numeric(10,3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_presupuesto_u_obra" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "presupuesto_id" integer NOT NULL,
  "u_obra_id" integer NOT NULL,
  "cantidad" numeric(10,2) NOT NULL,
  "monto_unitario" numeric(10,3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_presupuesto_vehiculo" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "presupuesto_id" integer NOT NULL,
  "vehiculo_id" integer NOT NULL,
  "cantidad" numeric(10,2) NOT NULL,
  "tarifa" numeric(12,2) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_trabajo" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "pmtdi" varchar(50) NOT NULL,
  "orden_mantenimiento" varchar(50),
  "zona" sot_trabajo_zona_enum NOT NULL,
  "area" sot_trabajo_area_enum NOT NULL,
  "tipo" sot_trabajo_tipo_enum NOT NULL,
  "tipo_mantenimiento" sot_trabajo_tipo_mantenimiento_enum NOT NULL,
  "tipo_intervencion" varchar(20),
  "fecha" date,
  "equipo_id" integer,
  "oc_id" integer,
  "descuentos_multas" numeric(12,3),
  "estado" sot_trabajo_estado_enum DEFAULT 'Planificacion' NOT NULL,
  "oc_numero" varchar(50),
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_trabajo_instalacion" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "trabajo_id" integer NOT NULL,
  "lugar_trabajo_id" integer NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "sot_trabajo_u_obra" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "trabajo_id" integer NOT NULL,
  "u_obra_id" integer NOT NULL,
  "cantidad_planificada" numeric(10,2),
  "cantidad_ejecutada" numeric(10,2),
  "monto_unitario" numeric(10,3) NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "stat_acum_veh_X_BD" (
  "periodo" integer NOT NULL,
  "semana" integer NOT NULL,
  "N_vehiculos" integer NOT NULL,
  "N_vehiculos_con_Doc" integer NOT NULL,
  "N_doc" integer NOT NULL,
  "tr_1" integer NOT NULL,
  "tr_2" integer NOT NULL,
  "tr_3" integer NOT NULL,
  "tr_4" integer NOT NULL
);

CREATE TABLE "stat_acum_vhe" (
  "tipo_Vhe" varchar(30) NOT NULL,
  "periodo" integer NOT NULL,
  "ccosto" varchar(50) NOT NULL,
  "ccosto_ap" varchar(30) NOT NULL,
  "gl_1" varchar(30) NOT NULL,
  "gl_2" varchar(30) NOT NULL,
  "dias" integer NOT NULL,
  "costXday" integer NOT NULL,
  "cost" integer NOT NULL
);

CREATE TABLE "tablas_varias" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "tipo" tablas_varias_tipo_enum DEFAULT 'VACIO',
  "codigo" integer DEFAULT 0,
  "glosa" varchar(50) DEFAULT ' ',
  "valor1" numeric(15,4) DEFAULT 0.0000,
  "valor2" numeric(15,4) DEFAULT 0.0000,
  "valor3" numeric(15,4),
  "valor4" numeric(15,4),
  "valor5" varchar(20),
  PRIMARY KEY ("id")
);

CREATE TABLE "tab_cartola_bco" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "fecha" date NOT NULL,
  "hora" varchar(8),
  "rut" varchar(15),
  "detalle" varchar(80) NOT NULL,
  "ctacte" integer,
  "numdoc" integer,
  "banco" varchar(50),
  "monto" integer NOT NULL,
  "estado" tab_cartola_bco_estado_enum DEFAULT 'INGRESADO' NOT NULL,
  "fec_estado" date,
  "id_pago" integer,
  "tipo_ref" varchar(30),
  "cliente" integer,
  "tipo_mov" smallint NOT NULL,
  "num_transfer" bigint NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "tab_lista_explode" (
  "cliente" integer,
  "numdoc" varchar(40)
);

CREATE TABLE "tmp_vhe_acum" (
  "id_Vhe" varchar(30) NOT NULL,
  "tipo_Vhe" varchar(30) NOT NULL,
  "periodo" integer NOT NULL,
  "ccosto" varchar(50) NOT NULL,
  "ccosto_ap" varchar(30) NOT NULL,
  "gl_1" varchar(30) NOT NULL,
  "gl_2" varchar(30) NOT NULL,
  "dias" integer NOT NULL,
  "costXday" integer NOT NULL,
  "cost" integer NOT NULL
);

CREATE TABLE "usuarios" (
  "usr_id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "usr_rut" varchar(10) DEFAULT '',
  "usr_nombre" varchar(40) DEFAULT '' NOT NULL,
  "usr_direccion" varchar(40) DEFAULT '' NOT NULL,
  "usr_comuna" varchar(20) DEFAULT '' NOT NULL,
  "usr_ciudad" varchar(20) DEFAULT '' NOT NULL,
  "usr_fono" varchar(12) DEFAULT '' NOT NULL,
  "usr_mail" varchar(50) NOT NULL,
  "usr_estado" usuarios_usr_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  "usr_area" smallint NOT NULL,
  "usr_user" varchar(20) DEFAULT '' NOT NULL,
  "usr_clave" varchar(50) NOT NULL,
  "usr_passwd" varchar(100) NOT NULL,
  "usr_fini" timestamp NOT NULL,
  "usr_ffin" timestamp DEFAULT '2099-12-31 00:00:00' NOT NULL,
  "usr_tipo" usuarios_usr_tipo_enum NOT NULL,
  "usr_perfil" integer NOT NULL,
  PRIMARY KEY ("usr_id")
);

CREATE TABLE "u_obra" (
  "id" integer NOT NULL,
  "codigo" varchar(120) NOT NULL,
  "objetivo" text NOT NULL,
  "unidad" varchar(120) NOT NULL,
  "monto" numeric(10,3) NOT NULL,
  "clasificacion" text NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE "valores_economicos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "tipo_param" valores_economicos_tipo_param_enum DEFAULT 'UTM' NOT NULL,
  "fecha" date NOT NULL,
  "valor1" numeric(10,4) NOT NULL,
  "glosa" varchar(30),
  "valor2" numeric(10,4),
  PRIMARY KEY ("id")
);

CREATE TABLE "vehiculos" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "glosa" varchar(30) NOT NULL,
  "patente" varchar(10) NOT NULL,
  "estado" vehiculos_estado_enum DEFAULT 'ACTIVO' NOT NULL,
  "ano" integer NOT NULL,
  "motor" varchar(30) NOT NULL,
  "chasis" varchar(30) NOT NULL,
  "marca" varchar(30) NOT NULL,
  "tipo" vehiculos_tipo_enum NOT NULL,
  "propio" vehiculos_propio_enum,
  "nombre_own" varchar(30),
  "ccosto_ap" varchar(30) NOT NULL,
  "tarifa_1" integer DEFAULT 0 NOT NULL,
  "tarifa_2" integer DEFAULT 0 NOT NULL,
  "id_bodega" integer NOT NULL,
  "id_mov" integer,
  "stock" integer DEFAULT 1 NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "acceso_funciones_acc_tipo" ON "acceso_funciones" ("acc_tipo", "acc_glosa");
CREATE INDEX "acceso_permisos_per_perfil" ON "acceso_permisos" ("per_perfil", "per_func");
CREATE INDEX "base_digital_estado" ON "base_digital" ("estado");
CREATE INDEX "base_digital_estado_2" ON "base_digital" ("estado", "tipo", "id_ref01");
CREATE INDEX "base_digital_tipo" ON "base_digital" ("tipo", "id_ref01");
CREATE UNIQUE INDEX "bodega_bodega" ON "bodega" ("bodega");
CREATE INDEX "categorias_codigo" ON "categorias" ("codigo");
CREATE UNIQUE INDEX "categorias_tipo" ON "categorias" ("tipo", "codigo");
CREATE INDEX "categorias_tipo_2" ON "categorias" ("tipo");
CREATE UNIQUE INDEX "centro_costo_ccosto" ON "centro_costo" ("ccosto", "estado");
CREATE UNIQUE INDEX "centro_costo_ccosto_2" ON "centro_costo" ("ccosto");
CREATE UNIQUE INDEX "data_cheques_cheque" ON "data_cheques" ("cheque", "estado");
CREATE UNIQUE INDEX "data_cheques_ctacte" ON "data_cheques" ("ctacte", "cheque", "estado");
CREATE INDEX "data_clientes_apellido" ON "data_clientes" ("apellido");
CREATE INDEX "data_clientes_nombre" ON "data_clientes" ("nombre");
CREATE UNIQUE INDEX "data_clientes_rut" ON "data_clientes" ("rut");
CREATE INDEX "data_clientes_tipo_reg" ON "data_clientes" ("tipo_reg");
CREATE INDEX "data_clientes_bco_cliente" ON "data_clientes_bco" ("cliente");
CREATE UNIQUE INDEX "data_clientes_bco_cliente_2" ON "data_clientes_bco" ("cliente", "ctacte", "banco", "estado");
CREATE INDEX "data_clientes_cargos_num_pago" ON "data_clientes_cargos" ("num_pago");
CREATE UNIQUE INDEX "data_clientes_cheques_banco" ON "data_clientes_cheques" ("banco", "ctacte", "cheque");
CREATE INDEX "data_clientes_cheques_fec_venc" ON "data_clientes_cheques" ("fec_venc");
CREATE INDEX "data_clientes_cheques_id_vta" ON "data_clientes_cheques" ("id_vta");
CREATE INDEX "data_clientes_factura_codigo" ON "data_clientes_factura" ("codigo");
CREATE INDEX "data_clientes_sucursal_cliente" ON "data_clientes_sucursal" ("cliente");
CREATE INDEX "data_personal_apellido" ON "data_personal" ("apellido");
CREATE INDEX "data_personal_nombre" ON "data_personal" ("nombre");
CREATE UNIQUE INDEX "data_personal_rut" ON "data_personal" ("rut");
CREATE INDEX "depositos_fecha" ON "depositos" ("fecha");
CREATE UNIQUE INDEX "depositos_numero" ON "depositos" ("numero", "banco");
CREATE INDEX "docs_emitidos_estado" ON "docs_emitidos" ("estado");
CREATE INDEX "docs_emitidos_fecha" ON "docs_emitidos" ("fecha");
CREATE INDEX "docs_emitidos_numdoc" ON "docs_emitidos" ("numdoc");
CREATE INDEX "docs_emitidos_tipo_doc" ON "docs_emitidos" ("tipo_doc");
CREATE UNIQUE INDEX "docs_emitidos_tipo_doc_2" ON "docs_emitidos" ("tipo_doc", "numdoc", "estado");
CREATE INDEX "docs_emitidos_detalle_numdoc" ON "docs_emitidos_detalle" ("numdoc");
CREATE INDEX "docs_emitidos_detalle_tipo_doc" ON "docs_emitidos_detalle" ("tipo_doc");
CREATE INDEX "docs_emitidos_detalle_tipo_doc_2" ON "docs_emitidos_detalle" ("tipo_doc", "cliente", "numdoc");
CREATE INDEX "docs_emitidos_plan_pago_id_doc" ON "docs_emitidos_plan_pago" ("id_doc");
CREATE UNIQUE INDEX "docs_pagos_banco" ON "docs_pagos" ("banco", "num_cheque", "numdoc", "cliente");
CREATE INDEX "docs_pagos_cliente" ON "docs_pagos" ("cliente");
CREATE INDEX "docs_pagos_fecha_pago" ON "docs_pagos" ("fecha_pago");
CREATE INDEX "docs_pagos_numdoc" ON "docs_pagos" ("numdoc");
CREATE INDEX "docs_pagos_ref_id_doc" ON "docs_pagos" ("ref_id_doc");
CREATE INDEX "docs_pagos_tipo_pago" ON "docs_pagos" ("tipo_pago");
CREATE INDEX "docs_pagos_fac_cliente" ON "docs_pagos_fac" ("cliente");
CREATE INDEX "docs_pagos_fac_id_fac" ON "docs_pagos_fac" ("id_fac");
CREATE INDEX "docs_pagos_fac_id_pago" ON "docs_pagos_fac" ("id_pago");
CREATE INDEX "docs_recibidos_ccosto" ON "docs_recibidos" ("ccosto");
CREATE INDEX "docs_recibidos_cliente" ON "docs_recibidos" ("cliente");
CREATE UNIQUE INDEX "docs_recibidos_cliente_2" ON "docs_recibidos" ("cliente", "numdoc", "tipo_doc");
CREATE INDEX "docs_recibidos_estado" ON "docs_recibidos" ("estado");
CREATE INDEX "docs_recibidos_fecha" ON "docs_recibidos" ("fecha");
CREATE INDEX "docs_recibidos_numdoc" ON "docs_recibidos" ("numdoc");
CREATE INDEX "docs_recibidos_tipo_doc" ON "docs_recibidos" ("tipo_doc");
CREATE UNIQUE INDEX "docs_recibidos_tipo_doc_2" ON "docs_recibidos" ("tipo_doc", "numdoc", "rut");
CREATE INDEX "docs_recibidos_tipo_doc_3" ON "docs_recibidos" ("tipo_doc", "estado");
CREATE INDEX "docs_recibidos_detalle_ccosto" ON "docs_recibidos_detalle" ("ccosto");
CREATE INDEX "docs_recibidos_detalle_ccosto_ap" ON "docs_recibidos_detalle" ("ccosto_ap");
CREATE INDEX "docs_recibidos_detalle_cliente" ON "docs_recibidos_detalle" ("cliente");
CREATE INDEX "docs_recibidos_detalle_numdoc" ON "docs_recibidos_detalle" ("numdoc");
CREATE INDEX "docs_recibidos_detalle_tipo_doc" ON "docs_recibidos_detalle" ("tipo_doc");
CREATE UNIQUE INDEX "empresa_rut" ON "empresa" ("rut");
CREATE UNIQUE INDEX "herramientas_Cod_equipo" ON "herramientas" ("Cod_equipo");
CREATE INDEX "materiales_cod_material" ON "materiales" ("cod_material");
CREATE INDEX "mov_bodega_id_bodega" ON "mov_bodega" ("id_bodega");
CREATE INDEX "mov_bodega_id_responsable" ON "mov_bodega" ("id_responsable");
CREATE INDEX "mov_bodega_id_vhe" ON "mov_bodega" ("id_vhe");
CREATE INDEX "mov_bodega_tipo_vhe" ON "mov_bodega" ("tipo_vhe");
CREATE INDEX "mov_bodega_tipo_vhe_2" ON "mov_bodega" ("tipo_vhe", "id_vhe");
CREATE UNIQUE INDEX "pagos_id_fac" ON "pagos" ("id_fac", "estado", "tipodoc", "fecha_ing");
CREATE UNIQUE INDEX "parametros_nombre" ON "parametros" ("nombre");
CREATE INDEX "rinde_gastos_ccosto" ON "rinde_gastos" ("ccosto");
CREATE INDEX "rinde_gastos_ccosto_ap" ON "rinde_gastos" ("ccosto_ap");
CREATE INDEX "rinde_gastos_cod_tipo_doc" ON "rinde_gastos" ("cod_tipo_doc");
CREATE INDEX "rinde_gastos_fecha_gasto" ON "rinde_gastos" ("fecha_gasto");
CREATE UNIQUE INDEX "sot_at_uq_sot_at_numero" ON "sot_at" ("numero_at");
CREATE UNIQUE INDEX "sot_at_uq_sot_at_trabajo" ON "sot_at" ("trabajo_id");
CREATE INDEX "sot_at_herramienta_idx_sot_at_herramienta_herr" ON "sot_at_herramienta" ("herramienta_id");
CREATE UNIQUE INDEX "sot_at_herramienta_uq_sot_at_herramienta" ON "sot_at_herramienta" ("at_id", "herramienta_id");
CREATE UNIQUE INDEX "sot_at_om_uq_sot_at_om" ON "sot_at_om" ("at_id", "orden_mantenimiento");
CREATE INDEX "sot_at_personal_idx_sot_at_personal_persona" ON "sot_at_personal" ("personal_codigo");
CREATE UNIQUE INDEX "sot_at_personal_uq_sot_at_personal" ON "sot_at_personal" ("at_id", "personal_codigo");
CREATE INDEX "sot_at_vehiculo_idx_sot_at_vehiculo_veh" ON "sot_at_vehiculo" ("vehiculo_id");
CREATE UNIQUE INDEX "sot_at_vehiculo_uq_sot_at_vehiculo" ON "sot_at_vehiculo" ("at_id", "vehiculo_id");
CREATE INDEX "sot_entregable_idx_sot_entregable_trabajo" ON "sot_entregable" ("trabajo_id");
CREATE UNIQUE INDEX "sot_equipo_uq_sot_equipo_lugar_nombre" ON "sot_equipo" ("lugar_trabajo_id", "nombre");
CREATE INDEX "sot_informe_idx_sot_informe_at" ON "sot_informe" ("at_id");
CREATE INDEX "sot_presupuesto_idx_sot_ppto_origen" ON "sot_presupuesto" ("origen_id");
CREATE UNIQUE INDEX "sot_presupuesto_uq_sot_ppto_num_rev" ON "sot_presupuesto" ("numero_solicitud", "revision");
CREATE UNIQUE INDEX "sot_presupuesto_cargo_uq_sot_ppto_cargo" ON "sot_presupuesto_cargo" ("descripcion");
CREATE INDEX "sot_presupuesto_herramienta_idx_sot_ppto_herr_herr" ON "sot_presupuesto_herramienta" ("herramienta_id");
CREATE UNIQUE INDEX "sot_presupuesto_herramienta_uq_sot_ppto_herr" ON "sot_presupuesto_herramienta" ("presupuesto_id", "herramienta_id");
CREATE INDEX "sot_presupuesto_material_idx_sot_ppto_mat_ppto" ON "sot_presupuesto_material" ("presupuesto_id");
CREATE INDEX "sot_presupuesto_personal_idx_sot_ppto_pers_cargo" ON "sot_presupuesto_personal" ("cargo_id");
CREATE INDEX "sot_presupuesto_personal_idx_sot_ppto_pers_persona" ON "sot_presupuesto_personal" ("personal_codigo");
CREATE UNIQUE INDEX "sot_presupuesto_personal_uq_sot_ppto_pers" ON "sot_presupuesto_personal" ("presupuesto_id", "personal_codigo");
CREATE INDEX "sot_presupuesto_u_obra_idx_sot_ppto_uobra_uo" ON "sot_presupuesto_u_obra" ("u_obra_id");
CREATE UNIQUE INDEX "sot_presupuesto_u_obra_uq_sot_ppto_uobra" ON "sot_presupuesto_u_obra" ("presupuesto_id", "u_obra_id");
CREATE INDEX "sot_presupuesto_vehiculo_idx_sot_ppto_veh_veh" ON "sot_presupuesto_vehiculo" ("vehiculo_id");
CREATE UNIQUE INDEX "sot_presupuesto_vehiculo_uq_sot_ppto_veh" ON "sot_presupuesto_vehiculo" ("presupuesto_id", "vehiculo_id");
CREATE INDEX "sot_trabajo_idx_sot_trabajo_equipo" ON "sot_trabajo" ("equipo_id");
CREATE UNIQUE INDEX "sot_trabajo_uq_sot_trabajo_oc" ON "sot_trabajo" ("oc_id");
CREATE UNIQUE INDEX "sot_trabajo_uq_sot_trabajo_pmtdi" ON "sot_trabajo" ("pmtdi");
CREATE INDEX "sot_trabajo_instalacion_idx_sot_trab_inst_lugar" ON "sot_trabajo_instalacion" ("lugar_trabajo_id");
CREATE UNIQUE INDEX "sot_trabajo_instalacion_uq_sot_trab_inst" ON "sot_trabajo_instalacion" ("trabajo_id", "lugar_trabajo_id");
CREATE INDEX "sot_trabajo_u_obra_idx_sot_trab_uobra_uo" ON "sot_trabajo_u_obra" ("u_obra_id");
CREATE UNIQUE INDEX "sot_trabajo_u_obra_uq_sot_trab_uobra" ON "sot_trabajo_u_obra" ("trabajo_id", "u_obra_id");
CREATE INDEX "stat_acum_veh_X_BD_periodo" ON "stat_acum_veh_X_BD" ("periodo");
CREATE INDEX "stat_acum_veh_X_BD_semana" ON "stat_acum_veh_X_BD" ("semana");
CREATE INDEX "stat_acum_vhe_ccosto" ON "stat_acum_vhe" ("ccosto");
CREATE INDEX "stat_acum_vhe_ccosto_ap" ON "stat_acum_vhe" ("ccosto_ap");
CREATE INDEX "stat_acum_vhe_periodo" ON "stat_acum_vhe" ("periodo");
CREATE INDEX "stat_acum_vhe_tipo_Vhe" ON "stat_acum_vhe" ("tipo_Vhe");
CREATE INDEX "tablas_varias_tipo" ON "tablas_varias" ("tipo");
CREATE INDEX "tab_cartola_bco_cliente" ON "tab_cartola_bco" ("cliente", "fecha");
CREATE INDEX "tab_cartola_bco_estado" ON "tab_cartola_bco" ("estado");
CREATE INDEX "tab_cartola_bco_fecha" ON "tab_cartola_bco" ("fecha");
CREATE UNIQUE INDEX "tab_cartola_bco_id_pago" ON "tab_cartola_bco" ("id_pago", "tipo_mov");
CREATE INDEX "tab_cartola_bco_numdoc" ON "tab_cartola_bco" ("numdoc");
CREATE UNIQUE INDEX "tab_cartola_bco_num_transfer" ON "tab_cartola_bco" ("num_transfer");
CREATE INDEX "tab_lista_explode_cliente" ON "tab_lista_explode" ("cliente");
CREATE INDEX "tmp_vhe_acum_id_Vhe" ON "tmp_vhe_acum" ("id_Vhe");
CREATE INDEX "tmp_vhe_acum_periodo" ON "tmp_vhe_acum" ("periodo");
CREATE INDEX "tmp_vhe_acum_tipo_Vhe" ON "tmp_vhe_acum" ("tipo_Vhe");
CREATE INDEX "tmp_vhe_acum_tipo_Vhe_2" ON "tmp_vhe_acum" ("tipo_Vhe", "id_Vhe", "periodo");
CREATE INDEX "usuarios_usr_rut" ON "usuarios" ("usr_rut");
CREATE UNIQUE INDEX "usuarios_usr_user" ON "usuarios" ("usr_user");
CREATE UNIQUE INDEX "u_obra_id" ON "u_obra" ("id");
CREATE INDEX "valores_economicos_tipo_param" ON "valores_economicos" ("tipo_param", "fecha");
CREATE INDEX "vehiculos_ccosto_ap" ON "vehiculos" ("ccosto_ap");
CREATE INDEX "vehiculos_estado" ON "vehiculos" ("estado");
CREATE INDEX "vehiculos_id_bodega" ON "vehiculos" ("id_bodega");
CREATE UNIQUE INDEX "vehiculos_patente" ON "vehiculos" ("patente");
>>>>>>> Stashed changes
