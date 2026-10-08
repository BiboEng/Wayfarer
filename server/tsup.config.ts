import { defineConfig } from 'tsup';

// Bundles src/index.ts (including @shared/* and package.json) into dist/index.js,
// so production runs `node dist/index.js` with no runtime ../shared resolution.
// tsup reads the `paths` in tsconfig.json to resolve @shared/*.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: false,
  dts: false,
  // Keep npm dependencies external; they are installed on the host.
  skipNodeModulesBundle: true,
});
