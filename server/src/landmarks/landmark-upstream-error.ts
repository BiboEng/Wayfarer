/**
 * Thrown when the landmark sources cannot deliver data (timeouts, 5xx, both
 * sources down, malformed replies). The route maps it to 502 UPSTREAM_FAILED.
 * The message never contains URLs, contact details or response bodies.
 */
export class LandmarkUpstreamError extends Error {
  readonly upstream: string;
  readonly status?: number;

  constructor(upstream: string, message: string, status?: number) {
    super(`${upstream}: ${message}`);
    this.name = 'LandmarkUpstreamError';
    this.upstream = upstream;
    this.status = status;
  }
}
