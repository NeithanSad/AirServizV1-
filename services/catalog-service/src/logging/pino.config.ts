import type { Params } from 'nestjs-pino';

/**
 * Logging estructurado (pino) con doble salida:
 *  - SIEMPRE consola: legible (pino-pretty) en dev, JSON puro en producción.
 *  - Si LOG_TCP_HOST está definido: además envía cada línea JSON a Logstash
 *    (stack ELK, ver infra/observability/logstash) vía pino-socket TCP.
 *
 * Sin LOG_TCP_HOST el servicio se comporta igual que antes — el stack ELK
 * es opcional en desarrollo.
 */
export function buildPinoParams(serviceName: string): Params {
  const consoleTarget =
    process.env.NODE_ENV === 'production'
      ? { target: 'pino/file', options: { destination: 1 }, level: 'info' } // stdout JSON
      : {
          target: 'pino-pretty',
          options: { singleLine: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname,service' },
          level: 'debug',
        };

  const logstashTarget = process.env.LOG_TCP_HOST
    ? [
        {
          target: 'pino-socket',
          options: {
            address: process.env.LOG_TCP_HOST,
            port: Number(process.env.LOG_TCP_PORT ?? 5000),
            mode: 'tcp',
            reconnect: true,
            reconnectTries: Infinity,
          },
          level: 'info',
        },
      ]
    : [];

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? 'debug',
      // Cada log lleva el nombre del servicio → filtrable en Kibana
      base: { service: serviceName },
      transport: { targets: [consoleTarget, ...logstashTarget] },
      // No registrar el scrape de Prometheus cada 15s
      autoLogging: { ignore: (req) => req.url === '/metrics' },
    },
  };
}
