/**
 * Tipos enumerados y utilidades compartidas por las entidades.
 *
 * Los nombres de los enum de PostgreSQL (`enumName`) tienen que coincidir
 * exactamente con los de database/init/01_schema.sql: TypeORM corre con
 * synchronize:false, así que el esquema manda y las entidades solo lo describen.
 */
import type { ValueTransformer } from 'typeorm';

export enum UnidadMedida {
  GL = 'GL',
  UNI = 'UNI',
  PAR = 'PAR',
  KG = 'KG',
  LT = 'LT',
  CAJA = 'CAJA',
  BOLSA = 'BOLSA',
}

export enum EstadoMaterial {
  ALTA = 'ALTA',
  BAJA = 'BAJA',
}

export enum EstadoBodega {
  VIGENTE = 'VIGENTE',
  NO_VIGENTE = 'NO_VIGENTE',
}

export enum EstadoCcosto {
  VIGENTE = 'VIGENTE',
  NO_VIGENTE = 'NO_VIGENTE',
  ABIERTO = 'ABIERTO',
  CERRADO = 'CERRADO',
}

export enum EstadoGenerico {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  ELIMINADO = 'ELIMINADO',
}

/** Reemplaza los códigos SII del ERP: 801 (OC), 999 (OC exenta) y HES. */
export enum TipoDocumento {
  OC = 'OC',
  OC_EXENTA = 'OC_EXENTA',
  HES = 'HES',
}

export enum EstadoDocumento {
  PENDIENTE = 'PENDIENTE',
  EMITIDO = 'EMITIDO',
  CERRADO = 'CERRADO',
  ANULADO = 'ANULADO',
  ELIMINADO = 'ELIMINADO',
}

export enum TipoMoneda {
  CLP = 'CLP',
  UF = 'UF',
  DOLAR = 'DOLAR',
  EURO = 'EURO',
  UTM = 'UTM',
}

export enum TipoMovimiento {
  IN = 'IN',
  OUT = 'OUT',
}

export enum TipoDocMovimiento {
  GR = 'GR',
  AJUSTE = 'AJUSTE',
}

export enum TipoCategoria {
  CAT = 'CAT',
  SUB = 'SUB',
  IND = 'IND',
}

export enum TipoFuncion {
  MENU = 'MENU',
  OPCION = 'OPCION',
  FUNCION = 'FUNCION',
  OTRO = 'OTRO',
}

export enum TipoAccion {
  INS_REG = 'INS_REG',
  MOD_REG = 'MOD_REG',
  DEL_REG = 'DEL_REG',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXEC_PROC = 'EXEC_PROC',
}

/**
 * El driver de PostgreSQL devuelve `numeric` como string para no perder
 * precisión. En cantidades y montos eso obliga a convertir en cada uso y es
 * fuente de bugs silenciosos (`"80" + 3` da `"803"`). Se convierte aquí.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | null): number | null =>
    value === null ? null : Number(value),
};
