import {
<<<<<<< Updated upstream
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min,
  ValidateNested,
} from 'class-validator';

import { BodegaService } from './bodega.service.js';
import { VMaterialBodega, VMovimientoBodega } from '../entities/vistas.entity.js';
import { Ctx, type ContextoAuditoria } from '../common/auditoria.js';
import { PaginacionDto, type RespuestaPaginada } from '../common/paginacion.js';
import { JwtAuthGuard, PermisosGuard, RequierePermiso } from '../common/permisos.js';

export class LineaMovimientoDto {
  @ApiProperty({ description: 'Id del material' })
  @IsInt() materialId: number;

  @ApiProperty({ example: 5 })
  @IsNumber() @Min(0.01) cantidad: number;
}

export class CargarHesDto {
  @ApiProperty({ description: 'Id de la HES a cargar' })
  @IsInt() hesId: number;

  @ApiProperty({ description: 'Bodega donde entra el material' })
  @IsInt() bodegaId: number;
}

export class EntregaDto {
  @ApiProperty() @IsInt() bodegaId: number;

  @ApiProperty({ description: 'Centro de costo al que se imputa el consumo' })
  @IsInt() ccostoDestinoId: number;

  @ApiPropertyOptional({ description: 'Usuario que recibe' })
  @IsOptional() @IsInt() responsableId?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(280) observacion?: string;

  @ApiProperty({ type: [LineaMovimientoDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => LineaMovimientoDto)
  lineas: LineaMovimientoDto[];
}

export class TraspasoDto {
  @ApiProperty() @IsInt() bodegaOrigenId: number;
  @ApiProperty() @IsInt() bodegaDestinoId: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(280) observacion?: string;

  @ApiProperty({ type: [LineaMovimientoDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true })
  @Type(() => LineaMovimientoDto)
  lineas: LineaMovimientoDto[];
}

export class AjusteDto {
  @ApiProperty() @IsInt() bodegaId: number;
  @ApiProperty() @IsInt() materialId: number;

  @ApiProperty({ example: 42, description: 'Stock que debe quedar tras el ajuste' })
  @IsNumber() @Min(0) nuevoStock: number;

  @ApiProperty({ example: 'Diferencia detectada en inventario físico' })
  @IsString() @MaxLength(240) motivo: string;
}

export class FiltroMovimientosDto extends PaginacionDto {
  @ApiPropertyOptional({ description: 'Código de bodega' })
  @IsOptional() @IsString() bodega?: string;

  @ApiPropertyOptional({ description: 'Código de material' })
  @IsOptional() @IsString() material?: string;
}

@ApiTags('Bodega')
@ApiBearerAuth()
@Controller('bodega')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class BodegaController {
  constructor(private readonly servicio: BodegaService) {}

  @Get('stock')
  @RequierePermiso('Stock por bodega')
  @ApiOperation({ summary: 'Saldo de materiales por bodega' })
  @ApiQuery({ name: 'bodega', required: false, description: 'Código de bodega' })
  @ApiQuery({ name: 'bajoMinimo', required: false })
  stock(
    @Query('bodega') bodega?: string,
    @Query('bajoMinimo') bajoMinimo?: string,
  ): Promise<VMaterialBodega[]> {
    return this.servicio.stock(bodega, bajoMinimo === 'true');
  }

  @Get('movimientos')
  @RequierePermiso('Movimientos')
  @ApiOperation({ summary: 'Libro de movimientos de material' })
  movimientos(
    @Query() q: FiltroMovimientosDto,
  ): Promise<RespuestaPaginada<VMovimientoBodega>> {
    return this.servicio.movimientos(q);
  }

  @Post('cargar-hes')
  @RequierePermiso('Carga desde HES')
  @ApiOperation({
    summary: 'Ingresa a bodega el material de una HES',
    description:
      'El código del material se extrae del texto de cada línea, con el formato ' +
      '"TEXTO/MC_nnn". Si alguna línea no resuelve, la carga completa se rechaza.',
  })
  cargarHes(
    @Body() dto: CargarHesDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string; movimientos: number }> {
    return this.servicio.cargarDesdeHes(dto.hesId, dto.bodegaId, ctx);
  }

  @Post('entregas')
  @RequierePermiso('Movimientos')
  @ApiOperation({
    summary: 'Entrega material a una persona',
    description:
      'Escribe dos movimientos por línea: la salida de la bodega y la ' +
      'imputación del costo al centro de costo de quien recibe. El stock baja una vez.',
  })
  entregar(
    @Body() dto: EntregaDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string; numdoc: number }> {
    return this.servicio.entregar(dto, ctx);
  }

  @Post('traspasos')
  @RequierePermiso('Movimientos')
  @ApiOperation({ summary: 'Traspasa material entre dos bodegas' })
  traspasar(
    @Body() dto: TraspasoDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string; numdoc: number }> {
    return this.servicio.traspasar(dto, ctx);
  }

  @Post('ajustes')
  @RequierePermiso('Ajusta stock')
  @ApiOperation({ summary: 'Corrige el saldo de un material en una bodega' })
  ajustar(
    @Body() dto: AjusteDto,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string; anterior: number; nuevo: number }> {
    return this.servicio.ajustar(dto, ctx);
  }

  @Delete('movimientos/:id')
  @RequierePermiso('Elimina movimiento')
  @ApiOperation({
    summary: 'Elimina un movimiento y revierte el saldo',
    description:
      'Réplica del ERP: la reversa mira solo el tipo del movimiento. En una ' +
      'entrega a persona, eliminar la fila de imputación de costo descuenta ' +
      'stock que nunca volvió a entrar.',
  })
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Ctx() ctx: ContextoAuditoria,
  ): Promise<{ mensaje: string }> {
    return this.servicio.eliminarMovimiento(id, ctx);
=======
  Body, Controller, Delete, Get, Ip, Param, ParseIntPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AjusteDto, BodegaService, CargarHesDto, GrDto } from './bodega.service';
import { JwtAuthGuard, PermisosGuard, Requiere } from '../comun/permisos.guard';

@Controller('bodega')
@UseGuards(JwtAuthGuard, PermisosGuard)
export class BodegaController {
  constructor(private readonly svc: BodegaService) {}

  @Get('stock')
  @Requiere('MATERIAL_X_BODEGA')
  stock(
    @Query('bodega') bodega?: string,
    @Query('buscar') buscar?: string,
    @Query('bajoMinimo') bajoMinimo?: string,
  ) {
    return this.svc.stock({
      bodega: bodega ? Number(bodega) : undefined,
      buscar, bajoMinimo: bajoMinimo === 'true',
    });
  }

  @Get('movimientos')
  @Requiere('BODEGA_MOVIMIENTOS')
  movimientos(
    @Query('bodega') bodega?: string,
    @Query('tipo_vhe') tipo_vhe?: string,
    @Query('id_vhe') id_vhe?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.svc.movimientos({
      bodega: bodega ? Number(bodega) : undefined,
      tipo_vhe, id_vhe,
      pagina: pagina ? Number(pagina) : undefined,
      limite: limite ? Number(limite) : undefined,
    });
  }

  @Get('bodegas')
  @Requiere('MATERIAL_X_BODEGA')
  bodegas() { return this.svc.bodegas(); }

  @Get('tipos-vhe')
  @Requiere('BODEGA_MOVIMIENTOS')
  tipos() { return this.svc.tiposVhe(); }

  @Get('items')
  @Requiere('MATERIAL_X_BODEGA')
  items(
    @Query('tipo_vhe') tipo_vhe: string,
    @Query('q') q?: string,
    @Query('bodega') bodega?: string,
  ) {
    return this.svc.buscarItems(tipo_vhe, q ?? '', bodega ? Number(bodega) : undefined);
  }

  /** Las lineas de una HES con su codigo de material ya resuelto. */
  @Get('hes/:numdoc')
  @Requiere('ING_MATERIAL')
  lineasHes(@Param('numdoc', ParseIntPipe) numdoc: number) {
    return this.svc.lineasDeHes(numdoc);
  }

  @Post('cargar-hes')
  @Requiere('ING_MATERIAL')
  cargar(@Body() dto: CargarHesDto, @Req() req: any, @Ip() ip: string) {
    return this.svc.cargarDesdeHes(dto, this.ctx(req, ip));
  }

  @Post('gr')
  @Requiere('ENTREGA_MAT')
  gr(@Body() dto: GrDto, @Req() req: any, @Ip() ip: string) {
    return this.svc.emitirGr(dto, this.ctx(req, ip));
  }

  @Post('ajuste')
  // AJUSTE_STK_MAT no existe en acceso_funciones: es un caso del despachador
  // que se abre desde la pantalla de stock, asi que hereda su permiso.
  @Requiere('MATERIAL_X_BODEGA')
  ajustar(@Body() dto: AjusteDto, @Req() req: any, @Ip() ip: string) {
    return this.svc.ajustar(dto, this.ctx(req, ip));
  }

  @Delete('movimientos/:id')
  @Requiere('ELIMINA_MOV_BODEGA')
  eliminar(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Ip() ip: string) {
    return this.svc.eliminarMovimiento(id, this.ctx(req, ip));
  }

  private ctx(req: any, ip: string) {
    return { usuario: req.user.login, ip, idUsuario: req.user.id_usuario };
>>>>>>> Stashed changes
  }
}
