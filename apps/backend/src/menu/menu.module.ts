import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { AuthModule } from '../auth/auth.module';
import { AccesoFuncion } from '../entidades/acceso.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AccesoFuncion]), AuthModule],
  controllers: [MenuController],
  providers: [MenuService],
})
export class MenuModule {}
