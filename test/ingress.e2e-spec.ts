import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureIngress } from '../src/configure-ingress';

interface IngressResponse {
  remoteAddress: string | null;
  headers: Record<string, string | string[] | null>;
  ips: string[];
  protocol: string;
}

describe('Ingress', () => {
  let app: NestExpressApplication;
  const original = process.env.INGRESS_PROBE_ENABLED;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureIngress(app);
    await app.init();
  });
  afterAll(async () => {
    if (original === undefined) delete process.env.INGRESS_PROBE_ENABLED;
    else process.env.INGRESS_PROBE_ENABLED = original;
    await app.close();
  });
  it.each([undefined, '', 'false', 'TRUE', '1'])(
    'disabled for %s',
    async (flag) => {
      if (flag === undefined) delete process.env.INGRESS_PROBE_ENABLED;
      else process.env.INGRESS_PROBE_ENABLED = flag;
      await request(app.getHttpServer())
        .get('/diagnostics/ingress')
        .expect(404);
      await request(app.getHttpServer()).get('/health/ready').expect(200);
    },
  );
  it('preserves duplicate lines, limits disclosure and demonstrates direct spoofing', async () => {
    process.env.INGRESS_PROBE_ENABLED = 'true';
    const response = await request(app.getHttpServer())
      .get('/diagnostics/ingress')
      .set('Host', 'local.invalid')
      .set('X-Forwarded-Host', ['attacker.invalid', 'second.invalid'])
      .set('X-Forwarded-For', '198.51.100.23')
      .set('X-Forwarded-Proto', 'https')
      .set('Authorization', 'Bearer private-test')
      .set('Cookie', 'private-cookie')
      .expect(200);
    const body = response.body as IngressResponse;
    expect(body).toMatchObject({
      host: 'local.invalid',
      hostname: 'attacker.invalid',
      ip: '198.51.100.23',
      ips: ['198.51.100.23'],
      protocol: 'https',
      trustProxy: 1,
      headers: {
        host: 'local.invalid',
        'x-forwarded-host': 'attacker.invalid, second.invalid',
        'x-forwarded-for': '198.51.100.23',
        'x-forwarded-proto': 'https',
      },
      rawHeaders: [
        { name: 'Host', value: 'local.invalid' },
        { name: 'X-Forwarded-Host', value: 'attacker.invalid' },
        { name: 'X-Forwarded-Host', value: 'second.invalid' },
        { name: 'X-Forwarded-For', value: '198.51.100.23' },
        { name: 'X-Forwarded-Proto', value: 'https' },
      ],
    });
    expect(Object.keys(body).sort()).toEqual(
      [
        'host',
        'hostname',
        'headers',
        'rawHeaders',
        'remoteAddress',
        'ip',
        'ips',
        'protocol',
        'trustProxy',
      ].sort(),
    );
    expect(JSON.stringify(body)).not.toContain('private-');
    expect(body.remoteAddress).toBeTruthy();
  });
  it('reports absent forwarding headers', async () => {
    process.env.INGRESS_PROBE_ENABLED = 'true';
    const response = await request(app.getHttpServer())
      .get('/diagnostics/ingress')
      .expect(200);
    const body = response.body as IngressResponse;
    for (const name of [
      'x-forwarded-host',
      'x-forwarded-for',
      'x-forwarded-proto',
    ])
      expect(body.headers[name]).toBeNull();
    expect(body.ips).toEqual([]);
    expect(body.protocol).toBe('http');
  });
});
