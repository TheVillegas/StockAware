/**
 * Esquemas solo para documentar los cuerpos que hoy son interfaces.
 *
 * Las interfaces no existen en tiempo de ejecucion, asi que Swagger no las ve.
 * Convertirlas en clases con class-validator haria que ValidationPipe
 * (whitelist) cambie lo que acepta cada endpoint; por eso se describen aqui y se
 * enlazan con @ApiBody. Los ejemplos son ficticios.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CargarHesDoc {
  @ApiProperty({ example: 1001, description: 'Numero de la HES a cargar' }) numdoc: number;
  @ApiProperty({ example: 1, description: 'Bodega de destino' }) bodega: number;
  @ApiPropertyOptional({ example: '2026-01-15', description: 'Por defecto, hoy' }) fecha?: string;
}

export class LineaMovDoc {
  @ApiProperty({ example: 'MC_001', description: 'Codigo del material o del item' }) id_vhe: string;
  @ApiProperty({ example: 5 }) cantidad: number;
  @ApiPropertyOptional({ example: 1500 }) tarifa?: number;
  @ApiPropertyOptional({ example: 'UNI' }) unidad?: string;
}

export class GrDoc {
  @ApiProperty({ enum: ['IN', 'OUT', 'MATERIAL'], description: 'IN entra, OUT sale, MATERIAL es fungible' })
  tipoMov: 'IN' | 'OUT' | 'MATERIAL';
  @ApiPropertyOptional({ enum: ['Bodega', 'Persona'], description: 'Solo para MATERIAL' })
  tipo_Cambio?: 'Bodega' | 'Persona';
  @ApiProperty({ example: 'MATERIAL' }) tipo_vhe: string;
  @ApiProperty({ example: 1 }) bodega: number;
  @ApiPropertyOptional({ example: 2 }) bodegaDestino?: number;
  @ApiPropertyOptional({ example: 10 }) id_responsable?: number;
  @ApiPropertyOptional({ example: 'CC-01' }) ccosto?: string;
  @ApiPropertyOptional({ example: 'CC-01' }) ccosto_ap?: string;
  @ApiPropertyOptional({ example: '2026-01-15' }) fecha?: string;
  @ApiPropertyOptional({ example: 'Entrega de ejemplo' }) obs?: string;
  @ApiProperty({ type: [LineaMovDoc] }) lineas: LineaMovDoc[];
}

export class AjusteDoc {
  @ApiProperty({ example: 1 }) bodega: number;
  @ApiProperty({ example: 'MC_001' }) cod_material: string;
  @ApiProperty({ example: 20, description: 'Saldo que debe quedar' }) stockNuevo: number;
  @ApiProperty({ example: 'Conteo fisico de ejemplo' }) motivo: string;
}

export class LineaOcDoc {
  @ApiProperty({ example: 1 }) producto: number;
  @ApiProperty({ example: 'Material de ejemplo' }) nombre: string;
  @ApiPropertyOptional({ example: 'Detalle de ejemplo' }) descripcion?: string;
  @ApiProperty({ example: 2 }) cantidad: number;
  @ApiProperty({ example: 'UNI' }) unidad: string;
  @ApiProperty({ example: 1000 }) precio_uni: number;
  @ApiPropertyOptional({ example: 0 }) descto?: number;
  @ApiProperty({ example: 2000 }) total: number;
  @ApiPropertyOptional({ example: 'CC-01' }) ccosto?: string;
  @ApiPropertyOptional({ example: 'CC-01' }) ccosto_ap?: string;
}

export class CrearOcDoc {
  @ApiProperty({ example: '801' }) tipo_doc: string;
  @ApiProperty({ example: 1 }) cliente: number;
  @ApiProperty({ example: '11.111.111-1', description: 'RUT ficticio' }) rut: string;
  @ApiProperty({ example: '2026-01-15' }) fecha: string;
  @ApiPropertyOptional({ example: 'CC-01' }) ccosto?: string;
  @ApiPropertyOptional({ example: 1 }) bodega?: number;
  @ApiPropertyOptional({ example: 'Orden de ejemplo' }) obs?: string;
  @ApiPropertyOptional({ example: 'CLP' }) tipo_moneda?: string;
  @ApiPropertyOptional({ example: 1 }) tipo_cambio?: number;
  @ApiProperty({ type: [LineaOcDoc] }) lineas: LineaOcDoc[];
}

export class LineaHesDoc {
  @ApiProperty({ example: 1, description: 'Linea de la OC que recibe la HES' }) id_linea: number;
  @ApiProperty({ example: 1 }) cantidad: number;
  @ApiProperty({ example: 50, description: 'Porcentaje que avanza la linea' }) avance: number;
  @ApiProperty({ example: 1000, description: 'Monto avanzado de la linea' }) monto: number;
  @ApiPropertyOptional({ example: 'Avance de ejemplo' }) comentario?: string;
  @ApiPropertyOptional({ example: 'CC-01' }) ccosto_ap?: string;
}

export class EmitirHesDoc {
  @ApiProperty({ example: 1, description: 'Id de la OC' }) id_OC: number;
  @ApiProperty({ example: '2026-01-15' }) fecha: string;
  @ApiProperty({ example: 1000 }) neto: number;
  @ApiProperty({ example: 190 }) iva: number;
  @ApiProperty({ example: 1190 }) total: number;
  @ApiPropertyOptional({ example: 'HES de ejemplo' }) obs?: string;
  @ApiProperty({ type: [LineaHesDoc] }) lineas: LineaHesDoc[];
}

export class AnularOcDoc {
  @ApiProperty({ example: 1, description: 'Id del cliente de la OC' }) cliente: number;
}

export class LineaDistribucionDoc {
  @ApiProperty({ example: 1, description: 'Linea de docs_recibidos_detalle del padre' }) id_detalle: number;
  @ApiProperty({ example: 'CC-01' }) ccosto: string;
  @ApiProperty({ example: 1000 }) neto: number;
  @ApiPropertyOptional({ enum: ['SI', 'NO'], description: "'SI' deja la linea sin IVA" })
  exento?: 'SI' | 'NO';
}

export class DistribuirDoc {
  @ApiProperty({ type: [LineaDistribucionDoc] }) lineas: LineaDistribucionDoc[];
}

export class CambiosMantenedorDoc {
  @ApiProperty({
    type: 'object', additionalProperties: true, example: { descripcion: 'Valor de ejemplo' },
    description: 'Campos a cambiar; los editables dependen del mantenedor',
  })
  cambios: Record<string, unknown>;
}

export class PublicacionPrecioDoc {
  @ApiProperty({ example: 12 }) publicacion_id: number;
  @ApiProperty({ example: 7, description: 'Id para PATCH /api/precios/vinculos/{id}' }) vinculo_id: number;
  @ApiProperty({ example: 'Amarra plastica 20 cm x 100' }) nombre: string;
  @ApiProperty({ example: 'Marca de ejemplo', nullable: true }) marca: string | null;
  @ApiProperty({ example: null, nullable: true }) ean: string | null;
  @ApiProperty({ example: 'https://www.dartel.cl/amarra-plastica/p' }) url: string;
  @ApiProperty({ example: 1990, description: 'CLP entero' }) precio_normal: number;
  @ApiPropertyOptional({ example: 1790, nullable: true }) precio_oferta?: number | null;
  @ApiProperty({ example: true }) disponible: boolean;
  @ApiProperty({ example: true, nullable: true, description: 'null si no esta verificado para la fuente' }) iva_incluido: boolean | null;
  @ApiProperty({ description: 'La lectura de esta publicacion quedo incompleta' }) parcial: boolean;
  @ApiProperty({ example: 0.8 }) puntaje: number;
  @ApiProperty({ enum: ['propuesto', 'confirmado'], description: 'propuesto = vinculo sin confirmar por una persona' })
  vinculo: string;
  @ApiProperty() obtenido_en: string;
  @ApiProperty() verificado_en: string;
}

export class FuentePrecioDoc {
  @ApiProperty({ enum: ['dartel', 'dimeiggs', 'solotodo', 'rhona', 'sodimac'] }) fuente: string;
  @ApiProperty({ enum: ['ok', 'sin_resultados', 'desactualizada', 'sin_datos'] }) estado: string;
  @ApiPropertyOptional({ enum: ['timeout', 'http_error', 'invalid_content', 'cooldown'] }) motivo?: string;
  @ApiPropertyOptional({ description: 'Sodimac no alcanzo a leer todo' }) parcial?: boolean;
  @ApiPropertyOptional({ description: 'Precio guardado cuya actualizacion fallo' }) desactualizado?: boolean;
  @ApiPropertyOptional() obtenido_en?: string;
  @ApiProperty({ type: [PublicacionPrecioDoc] }) publicaciones: PublicacionPrecioDoc[];
}

export class RespuestaPreciosDoc {
  @ApiProperty({ example: 'MC_001' }) cod_material: string;
  @ApiProperty({ example: 'Amarra plastica' }) nombre: string;
  @ApiProperty() cotizable: boolean;
  @ApiPropertyOptional({ example: 'personalizado', description: 'Solo con cotizable: false' }) motivo?: string;
  @ApiPropertyOptional() desactualizado?: boolean;
  @ApiProperty({ type: [FuentePrecioDoc] }) fuentes: FuentePrecioDoc[];
}

export class VinculoRespuestaDoc {
  @ApiProperty({ example: 7 }) id: number;
  @ApiProperty({ example: 'MC_001' }) cod_material: string;
  @ApiProperty({ example: 12 }) publicacion_id: number;
  @ApiProperty({ enum: ['confirmado', 'rechazado'] }) estado: string;
  @ApiProperty({ example: 'usuario' }) definido_por: string;
}

export class FuenteUrlRespuestaDoc {
  @ApiProperty({ example: 'MC_001' }) cod_material: string;
  @ApiProperty({ enum: ['rhona', 'sodimac'] }) fuente: string;
  @ApiProperty({ example: 'https://rhona.cl/catalogo/4/materiales-electricos/35/herramientas.html' }) url: string;
  @ApiProperty({ nullable: true, description: 'URL que tenia antes; null si no habia' }) url_anterior: string | null;
}

export class CotizableRespuestaDoc {
  @ApiProperty({ example: 'MC_001' }) cod_material: string;
  @ApiProperty() cotizable: boolean;
  @ApiProperty({ nullable: true, example: 'servicio' }) motivo: string | null;
  @ApiProperty({ example: 'usuario' }) definido_por: string;
}
