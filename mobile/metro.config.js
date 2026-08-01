const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.maxWorkers = 1;

// Habilitar soporte para la propiedad "exports" de los package.json
config.resolver.unstable_enablePackageExports = true;

// Add buffer polyfill to extraNodeModules
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  buffer: require.resolve('buffer'),
};

module.exports = config;
