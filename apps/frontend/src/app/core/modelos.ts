/** Tipos que viajan entre el backend y la interfaz. */

export type UnidadMedida = 'GL' | 'UNI' | 'PAR' | 'KG' | 'LT' | 'CAJA' | 'BOLSA';
export const UNIDADES: UnidadMedida[] = ['GL', 'UNI', 'PAR', 'KG', 'LT', 'CAJA', 'BOLSA'];

export type EstadoDocumento =
  | 'PENDIENTE'
  | 'EMITIDO'
  | 'CERRADO'
  | 'ANULADO'
  | 'ELIMINADO';

export interface UsuarioAutenticado {
  id: number;
  username: string;
  nombre: string;
  email: string;
  perfil: string;
  permisos: string[];
}

export interface LoginRespuesta {
  access_token: string;
  usuario: UsuarioAutenticado;
}

export interface Pagina<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
  paginas: number;
}

export interface LineaDocumento {
  id: number;
  nombre: string;
  descripcion: string;
  comentario: string | null;
  cantidad: number;
  unidad: string;
  precioUni: number;
  descuento: number;
  total: number;
  ocAvance: number;
}

export interface Documento {
  id: number;
  tipo: 'OC' | 'OC_EXENTA' | 'HES';
  numdoc: number;
  fecha: string;
  estado: EstadoDocumento;
  ocAvance: number;
  neto: number;
  iva: number;
  total: number;
  cargadaABodega: boolean;
  observacion: string | null;
  proveedor?: { id: number; rut: string; nombre: string; apellido: string };
  ccosto?: { id: number; ccosto: string } | null;
  oc?: Documento | null;
  detalle?: LineaDocumento[];
}

export interface FilaStock {
  materialId: number;
  codMaterial: string;
  nombre: string;
  unidad: UnidadMedida;
  bodegaId: number;
  bodegaCodigo: number;
  bodega: string;
  stock: number;
  stockMinimo: number;
  tarifa: number;
  bajoMinimo: boolean;
}

/** Lo pendiente de recibir de una línea, con la regla del ERP. */
export const pendienteDe = (l: LineaDocumento): number =>
  Math.round(l.cantidad * ((100 - l.ocAvance) / 100) * 100) / 100;

export const clp = (n: number | null | undefined): string =>
  n == null ? '' : '$' + Math.round(n).toLocaleString('es-CL');
