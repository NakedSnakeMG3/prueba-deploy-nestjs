import { Controller, Get, NotFoundException, Req } from '@nestjs/common';
import type { Request } from 'express';

@Controller('diagnostics')
export class DiagnosticsController {
  @Get('ingress')
  ingress(@Req() request: Request) {
    if (process.env.INGRESS_PROBE_ENABLED !== 'true') {
      throw new NotFoundException();
    }

    const names = [
      'host',
      'x-forwarded-host',
      'x-forwarded-for',
      'x-forwarded-proto',
    ];
    const rawHeaders: { name: string; value: string }[] = [];
    for (let i = 0; i < request.rawHeaders.length; i += 2) {
      const name = request.rawHeaders[i];
      if (names.includes(name.toLowerCase())) {
        rawHeaders.push({ name, value: request.rawHeaders[i + 1] });
      }
    }

    return {
      host: request.headers.host ?? null,
      rawHeaders,
      headers: Object.fromEntries(
        names.map((name) => [name, request.headers[name] ?? null]),
      ),
      remoteAddress: request.socket.remoteAddress ?? null,
      hostname: request.hostname ?? null,
      ip: request.ip ?? null,
      ips: request.ips,
      protocol: request.protocol,
      trustProxy: request.app.get('trust proxy') as unknown,
    };
  }
}
