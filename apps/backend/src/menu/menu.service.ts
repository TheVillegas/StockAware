/**
 * Arma el menu igual que el ERP: desde acceso_funciones, filtrado por los
 * permisos del perfil. Un MENU con hijos visibles se muestra; si el perfil no
 * tiene ninguna de sus opciones, el menu no aparece.
 *
 * FUERA_DE_ALCANCE lista lo que quedo excluido de la replica. La fila sigue
 * existiendo en la base (no se toco acceso_funciones), pero no se ofrece,
 * porque no hay pantalla detras. Cuando una capa se implemente, se saca de
 * aca y aparece sola.
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccesoFuncion } from '../entidades/acceso.entity';

/** Menus completos que no se migran. */
const MENUS_FUERA = [
  'PROYECTOS', 'VENTAS', 'TICKETS', 'FACTURACION', 'DTE',
  'ADM_REMUN', 'CON_REMUN', 'OTROS_REMUN', 'RRHH_COSTOS', 'RRHH_CAPACITA',
  'RRHH_TURNOS', 'ADM_TURNOS', 'RRHH_ADM', 'RRHH_OLD', 'MANTENEDOR_PERS_REM',
];

/** Opciones sueltas que no se migran, dentro de menus que si van. */
const OPCIONES_FUERA = [
  'AJUSTE_BODEGA', 'CHG_CC_MOV', 'DESCARGA_DET_BODEGA',           // capa 3
  'PAGOS_INGRESA', 'PAGOS_VALIDA', 'PAGOS_CONSULTA',              // capa 4
  'PAGOS_DE_DOCS', 'ADM_CHEQUES', 'NOTA_DEPOSITO', 'CARGA_CARTOLA_2',
  'RG_VALIDA', 'CON_RGASTO', 'CHG_CC_RG',                         // capa 5
  'DOC_REC', 'HEADER_CTACTE',                                     // excluidos
  'SII_DOCS', 'GET_DOCS_SII', 'DTE_TEMP',                         // conexion SII
];

export interface OpcionMenu {
  id: number;
  codigo: string;
  titulo: string;
  implementada: boolean;
}
export interface GrupoMenu {
  id: number;
  codigo: string;
  titulo: string;
  opciones: OpcionMenu[];
}

/** Lo que ya tiene pantalla construida. Crece capa por capa. */
const IMPLEMENTADAS = new Set<string>([
  // Capa 1: mantenedores de maestros
  'ADM_COMUNA',
  'ADM_CATEGORIA',
  'ADM_CCOSTO',
  'ADM_CLIENTE',
  'ADM_PROVEEDOR',
  'ADM_PERSONAL',
  'ADM_EMPRESA',
  'ADM_BANCO_CTA',
  'ADM_VAL_ECONOMICO',
  'ADM_AREAS',
  'ADM_BODEGA',
  'ADM_MAT_FUN',
  'ADM_EQUIPOS',
  'ADM_VEHICULO',
  'ADM_U_OBRA',
  'ADM_LUGAR_TRABAJO',
  'PERFILES',
  // Capa 2: compras
  'CON_DOC_EMI',
  'EMITE_OC',
  'EDITA_OC',
  'EMITE_HES',
  // Capa 3: bodega
  'MATERIAL_X_BODEGA',
  'BODEGA_MOVIMIENTOS',
  'ING_MATERIAL',
  'EMITE_GR',
  'RECIBE_GR',
  'ENTREGA_MAT',
  // Capa 4: distribucion de facturas
  'DOC_DISTRIBUIR',
  // Capa 6: balance de centro de costo
  'BALANCE_CCOSTO',
]);

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(AccesoFuncion) private readonly funciones: Repository<AccesoFuncion>,
  ) {}

  async armar(permisos: string[]): Promise<GrupoMenu[]> {
    const activas = await this.funciones.find({
      where: { acc_estado: 'ACTIVO', acc_tipo: In(['MENU', 'OPCION']) },
      order: { acc_id: 'ASC' },
    });

    const menus = activas.filter(
      (f) => f.acc_tipo === 'MENU' && !MENUS_FUERA.includes(f.acc_glosa),
    );
    const permitidas = new Set(permisos);

    return menus
      .map((m) => ({
        id: m.acc_id,
        codigo: m.acc_glosa,
        titulo: m.acc_descripcion?.trim() || m.acc_glosa,
        opciones: activas
          .filter(
            (o) =>
              o.acc_tipo === 'OPCION' &&
              o.acc_padre === m.acc_id &&
              !OPCIONES_FUERA.includes(o.acc_glosa) &&
              permitidas.has(o.acc_glosa),
          )
          .map((o) => ({
            id: o.acc_id,
            codigo: o.acc_glosa,
            titulo: o.acc_descripcion?.trim() || o.acc_glosa,
            implementada: IMPLEMENTADAS.has(o.acc_glosa),
          })),
      }))
      .filter((g) => g.opciones.length > 0);
  }
}
