// https://docs.expo.dev/guides/using-eslint/
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  // server/ is a separate package with its own lint config.
  globalIgnores(['dist/*', '.expo/*', 'coverage/*', 'server/**']),
  expoConfig,
]);
