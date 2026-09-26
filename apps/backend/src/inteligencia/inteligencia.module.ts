import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InteligenciaController } from './inteligencia.controller';
import { IntelligenceService } from './inteligencia.service';

@Module({
  imports: [AuthModule],
  controllers: [InteligenciaController],
  providers: [IntelligenceService],
})
export class InteligenciaModule {}
