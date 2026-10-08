import { existsSync } from 'node:fs';

/**
 * Loads server/.env into process.env if the file exists. Real environment
 * variables win over the file. Works on Node 20.12+ and 24 without CLI flags.
 */
export function loadEnvFile(path = '.env'): void {
  if (existsSync(path)) process.loadEnvFile(path);
}
