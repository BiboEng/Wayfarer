/** Response of GET /health. */
export interface HealthResponse {
  status: 'ok';
  /** Server package version, e.g. "0.1.0". */
  version: string;
}
