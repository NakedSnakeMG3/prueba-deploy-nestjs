import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureIngress } from './configure-ingress';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureIngress(app);
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
