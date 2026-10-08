import { createApp } from './app';
import { EnvError, parseEnv, type ServerConfig } from './config/env';
import { loadEnvFile } from './config/load-env-file';

function main(): void {
  loadEnvFile();

  let config: ServerConfig;
  try {
    config = parseEnv(process.env);
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const app = createApp(config);
  app.listen(config.port, config.host, () => {
    console.log(`Wayfarer server listening on ${config.host}:${config.port}`);
  });
}

main();
