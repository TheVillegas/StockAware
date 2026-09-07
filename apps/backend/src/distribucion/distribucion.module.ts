import { Module } from '@nestjs/common';
import { DistribucionController } from './distribucion.controller';
import { DistribucionService } from './distribucion.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [DistribucionController],
  providers: [DistribucionService],
})
export class DistribucionModule {}
