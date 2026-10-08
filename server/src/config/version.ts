// esbuild (tsup) and tsx both inline JSON imports, so this survives bundling.
import pkg from '../../package.json';

export const SERVER_VERSION: string = pkg.version;
