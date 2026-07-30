const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.maxWorkers = 1;

// Habilitar soporte para la propiedad "exports" de los package.json
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
