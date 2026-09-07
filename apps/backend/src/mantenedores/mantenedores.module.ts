import { Module } from '@nestjs/common';
import { MantenedoresController } from './mantenedores.controller';
import { MantenedoresService } from './mantenedores.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MantenedoresController],
  providers: [MantenedoresService],
})
export class MantenedoresModule {}
