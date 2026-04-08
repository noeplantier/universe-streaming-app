const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // Indispensable pour Expo Router et le support Web
  isStandardEngine: true,
});

// Sur Netlify, on évite le cache disque personnalisé qui peut causer des erreurs de module
if (process.env.NETLIFY) {
  config.cacheStores = [];
  config.maxWorkers = 1; // Netlify a des ressources limitées, 1 worker évite les crashs mémoire
} else {
  config.maxWorkers = 2;
}

module.exports = config;
