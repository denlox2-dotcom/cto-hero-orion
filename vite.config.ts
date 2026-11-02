import { defineConfig } from 'vite';
import { leaderboardPlugin } from './server/vite-plugin.mjs';
export default defineConfig({ base: './', plugins: [leaderboardPlugin()], server: { fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', '**/local-data/**', '**/admin-key.txt', '**/*.sqlite*'] } }, build: { chunkSizeWarningLimit: 1800 } });
