/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // server/ is a separate package (vitest); ignore it so its package.json doesn't collide.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/server/'],
  modulePathIgnorePatterns: ['<rootDir>/server/'],
  // Mirrors the tsconfig.json "paths" (jest does not read them).
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
