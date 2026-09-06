/**
 * Registro central de entidades.
 *
 * Se listan explícitamente en vez de descubrirlas con un glob: el proyecto usa
 * ESM y la carga por patrón deja de funcionar al compilar. Además, una lista
 * explícita falla de inmediato si alguien olvida registrar una entidad, en vez
 * de fallar en tiempo de consulta.
 */
export * from './tipos.js';
export * from './acceso.entity.js';
export * from './maestros.entity.js';
export * from './documentos.entity.js';
export * from './inventario.entity.js';
export * from './sistema.entity.js';
export * from './vistas.entity.js';

import { Funcion, Perfil, Permiso, Usuario } from './acceso.entity.js';
import {
  Bodega,
  Categoria,
  CentroCosto,
  Material,
  Proveedor,
} from './maestros.entity.js';
import { Documento, DocumentoDetalle } from './documentos.entity.js';
import { MaterialBodega, MovimientoBodega } from './inventario.entity.js';
import { Parametro, Registro } from './sistema.entity.js';
import {
  VMaterial,
  VMaterialBodega,
  VMovimientoBodega,
} from './vistas.entity.js';

export const ENTIDADES = [
  // Acceso
  Perfil,
  Funcion,
  Permiso,
  Usuario,
  // Maestros
  Categoria,
  CentroCosto,
  Bodega,
  Proveedor,
  Material,
  // Documentos de compra
  Documento,
  DocumentoDetalle,
  // Inventario
  MaterialBodega,
  MovimientoBodega,
  // Sistema
  Registro,
  Parametro,
  // Vistas
  VMaterial,
  VMaterialBodega,
  VMovimientoBodega,
];
