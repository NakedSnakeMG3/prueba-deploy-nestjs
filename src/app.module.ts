import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiagnosticsController } from './diagnostics/diagnostics.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [],
  controllers: [AppController, DiagnosticsController, HealthController],
  providers: [AppService],
})
export class AppModule {}
