import { createServer, type Server } from 'node:http';

/** Reads the current gateway readiness without making a Discord API request. */
export type ReadinessCheck = () => boolean;

/** Starts a container-local readiness endpoint on the application's event loop. */
export const startHealthServer = (isReady: ReadinessCheck, port: number = 8080): Promise<Server> =>
  new Promise<Server>((resolve, reject) => {
    const server: Server = createServer((request, response): void => {
      response.setHeader('Cache-Control', 'no-store');
      if (request.method !== 'GET' || request.url !== '/healthz') {
        response.writeHead(404).end();
        return;
      }

      const ready: boolean = isReady();
      response.setHeader('Content-Type', 'application/json');
      response.writeHead(ready ? 200 : 503).end(JSON.stringify({ status: ready ? 'healthy' : 'unhealthy' }));
    });

    server.once('error', reject);
    server.listen(port, '127.0.0.1', (): void => {
      server.off('error', reject);
      resolve(server);
    });
  });
