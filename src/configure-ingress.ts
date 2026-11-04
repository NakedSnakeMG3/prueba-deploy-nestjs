import { NestExpressApplication } from '@nestjs/platform-express';

export function configureIngress(app: NestExpressApplication): void {
  // Experimental hypothesis only: neither authenticates Railway nor proves topology.
  app.set('trust proxy', 1);
}
