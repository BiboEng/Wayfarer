/**
 * A paid upstream (AI model, voice service) failed. The message never contains
 * URLs, keys, request bodies or response bodies, so it is safe to log.
 */
export class UpstreamError extends Error {
  readonly upstream: string;
  readonly status?: number;

  constructor(upstream: string, message: string, status?: number) {
    super(`${upstream}: ${message}`);
    this.name = 'UpstreamError';
    this.upstream = upstream;
    this.status = status;
  }
}
