import { Module } from '@nestjs/common';
import { BodegaController } from './bodega.controller';
import { BodegaService } from './bodega.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [BodegaController],
  providers: [BodegaService],
})
export class BodegaModule {}
