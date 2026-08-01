const { execSync } = require('child_process');

// Empreinte de la version déployée, figée au moment du build : elle permet de
// vérifier d'un coup d'œil quel code tourne réellement sur un serveur.
function buildStamp() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'inconnu'; // dépôt absent (image Docker, archive...)
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: process.env.BUILD_COMMIT || buildStamp(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 16).replace('T', ' '),
  },
};

module.exports = nextConfig;
