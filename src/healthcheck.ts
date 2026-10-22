/** Exits successfully only when the running bot reports gateway readiness. */
void fetch('http://127.0.0.1:8080/healthz', { signal: AbortSignal.timeout(2000) })
  .then((response: Response): never => process.exit(response.status === 200 ? 0 : 1))
  .catch((): never => process.exit(1));
