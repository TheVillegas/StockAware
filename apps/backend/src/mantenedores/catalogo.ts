/**
 * Catalogo de mantenedores, replicando Mant_Tablas.php.
 *
 * El ERP no tiene 17 pantallas: tiene UNA, parametrizada por tipo. Cada tipo
 * dice de que vista se lee, en que tabla se escribe y como se ordena. Esto es
 * la traduccion directa del switch de Consulta_Tabla().
 *
 * `lee` suele ser una vista (trae las glosas ya resueltas) y `escribe` la tabla
 * base. Cuando no hay vista, ambas son la misma tabla.
 */
export interface Mantenedor {
  /** Codigo de acceso_funciones que abre la pantalla. */
  codigo: string;
  titulo: string;
  lee: string;
  escribe: string;
  pk: string;
  orden: string;
  /** Filtro fijo del ERP, tal cual esta en Consulta_Tabla. */
  filtro?: string;
  /** Permiso de acceso_funciones que habilita modificar. */
  permisoEscritura?: string;
  /** Columnas del listado, en orden. */
  columnas: string[];
  /** Columnas derivadas de la vista: se muestran pero no se editan. */
  soloLectura?: string[];
}

export const MANTENEDORES: Mantenedor[] = [
  {
    codigo: 'ADM_COMUNA', titulo: 'Comunas',
    lee: 'comunas', escribe: 'comunas', pk: 'com_id', orden: 'com_glosa ASC',
    columnas: ['com_id', 'com_glosa', 'provincia', 'region'],
  },
  {
    codigo: 'ADM_CATEGORIA', titulo: 'Categorias',
    lee: 'categorias', escribe: 'categorias', pk: 'id', orden: 'tipo, codigo ASC',
    permisoEscritura: 'MOD_CAT',
    columnas: ['id', 'tipo', 'padre', 'codigo', 'glosa', 'unidad'],
  },
  {
    codigo: 'ADM_CCOSTO', titulo: 'Centros de costo',
    lee: 'v_ccosto', escribe: 'centro_costo', pk: 'id', orden: 'ccosto ASC',
    permisoEscritura: 'MOD_CCOSTO',
    columnas: ['id', 'ccosto', 'nom', 'proyecto', 'fini', 'ffin', 'estado', 'responsable'],
    soloLectura: ['nom', 'responsable', 'sucursal', 'codigo_cc', 'mail_responsable', 'dias_vig'],
  },
  {
    codigo: 'ADM_CLIENTE', titulo: 'Clientes',
    lee: 'v_clientes', escribe: 'data_clientes', pk: 'codigo', orden: 'codigo ASC',
    permisoEscritura: 'MOD_CLIENTE',
    columnas: ['codigo', 'rut', 'nombre', 'apellido', 'com_glosa', 'fono', 'email', 'estado'],
    soloLectura: ['com_glosa'],
  },
  {
    codigo: 'ADM_PROVEEDOR', titulo: 'Proveedores',
    lee: 'v_proveedor', escribe: 'data_clientes', pk: 'codigo', orden: 'codigo ASC',
    permisoEscritura: 'MOD_PROVEEDOR',
    columnas: ['codigo', 'rut', 'nombre', 'apellido', 'com_glosa', 'fono', 'email', 'estado'],
    soloLectura: ['com_glosa', 'cat_glosa'],
  },
  {
    codigo: 'ADM_PERSONAL', titulo: 'Personal',
    lee: 'v_personal', escribe: 'data_personal', pk: 'codigo', orden: 'codigo ASC',
    permisoEscritura: 'MOD_PERSONAL',
    columnas: ['codigo', 'rut', 'nombre_apellido', 'gl_cargo', 'gl_area', 'estado'],
    soloLectura: ['nombre_apellido', 'gl_cargo', 'gl_area', 'gl_salud', 'gl_afp',
      'gl_ubicacion', 'gl_sucursal', 'gl_categoria', 'por_afp', 'porcentaje_turno'],
  },
  {
    codigo: 'ADM_EMPRESA', titulo: 'Empresa',
    lee: 'empresa', escribe: 'empresa', pk: 'id', orden: 'razon ASC',
    permisoEscritura: 'MOD_EMPRESA',
    columnas: ['id', 'rut', 'razon', 'giro', 'direcc', 'ciudad', 'estado'],
  },
  {
    codigo: 'ADM_BANCO_CTA', titulo: 'Cuentas bancarias',
    lee: 'v_adm_banco', escribe: 'adm_bancos', pk: 'id', orden: 'banco ASC',
    permisoEscritura: 'MOD_BANCO_CTA',
    columnas: ['id', 'gl_banco', 'ctacte', 'folio_ini', 'folio_fin', 'folio_actual', 'estado'],
    soloLectura: ['gl_banco'],
  },
  {
    codigo: 'ADM_VAL_ECONOMICO', titulo: 'Valores economicos',
    lee: 'valores_economicos', escribe: 'valores_economicos', pk: 'id', orden: 'fecha DESC',
    permisoEscritura: 'MOD_VALECONOM',
    columnas: ['id', 'tipo_param', 'fecha', 'valor1', 'valor2', 'glosa'],
  },
  {
    codigo: 'ADM_AREAS', titulo: 'Areas',
    lee: 'rrhh_areas', escribe: 'rrhh_areas', pk: 'id', orden: 'descripcion ASC',
    permisoEscritura: 'MOD_AREAS',
    columnas: ['id', 'descripcion'],
  },
  {
    codigo: 'ADM_BODEGA', titulo: 'Bodegas',
    lee: 'v_bodega', escribe: 'bodega', pk: 'id', orden: 'bodega ASC',
    permisoEscritura: 'MOD_BODEGA',
    columnas: ['id', 'bodega', 'descr', 'ccosto', 'nombre', 'estado'],
    soloLectura: ['nombre'],
  },
  {
    codigo: 'ADM_MAT_FUN', titulo: 'Materiales fungibles',
    lee: 'v_materiales', escribe: 'materiales', pk: 'cod_material', orden: 'cod_material ASC',
    permisoEscritura: 'MOD_MATERIALES',
    columnas: ['cod_material', 'nombre', 'unidad_desc', 'ccosto_ap', 'tarifa', 'stock_minimo', 'estado'],
    soloLectura: ['unidad_desc'],
  },
  {
    codigo: 'ADM_EQUIPOS', titulo: 'Equipos y herramientas',
    lee: 'v_herramientas', escribe: 'herramientas', pk: 'id', orden: '"Cod_equipo" ASC',
    permisoEscritura: 'MOD_HERRAMIENTAS',
    columnas: ['id', 'Cod_equipo', 'Nom_equipo', 'Marca', 'Modelo', 'Serie', 'descr', 'estado'],
    soloLectura: ['descr', 'proxCert', 'date_diff'],
  },
  {
    codigo: 'ADM_VEHICULO', titulo: 'Vehiculos',
    lee: 'v_vehiculos', escribe: 'vehiculos', pk: 'id', orden: 'patente, tipo ASC',
    filtro: "estado <> 'BAJA'",
    permisoEscritura: 'MOD_VEHICULOS',
    columnas: ['id', 'patente', 'glosa', 'marca', 'tipo', 'ano', 'descr', 'estado'],
    soloLectura: ['descr', 'code_own', 'diasDue'],
  },
  {
    codigo: 'ADM_U_OBRA', titulo: 'Unidades de obra',
    lee: 'u_obra', escribe: 'u_obra', pk: 'id', orden: 'codigo ASC',
    permisoEscritura: 'MOD_U_OBRA',
    columnas: ['id', 'codigo', 'objetivo', 'unidad', 'monto', 'clasificacion'],
  },
  {
    codigo: 'ADM_LUGAR_TRABAJO', titulo: 'Lugares de trabajo',
    lee: 'v_lugar_trabajo', escribe: 'lugar_trabajo', pk: 'id', orden: 'nombre ASC',
    permisoEscritura: 'MOD_LUGAR_TRABAJO',
    columnas: ['id', 'nombre', 'tipo', 'region', 'cliente'],
    soloLectura: ['cliente'],
  },
  {
    codigo: 'PERFILES', titulo: 'Perfiles de acceso',
    lee: 'acceso_perfiles', escribe: 'acceso_perfiles', pk: 'per_id', orden: 'per_glosa ASC',
    filtro: "per_estado <> 'ELIMINADO'",
    columnas: ['per_id', 'per_glosa', 'url_inicio', 'per_estado'],
  },
];

export const buscaMantenedor = (codigo: string): Mantenedor | undefined =>
  MANTENEDORES.find((m) => m.codigo === codigo);
