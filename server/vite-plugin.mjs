import { createLeaderboardApi } from './leaderboard.mjs';

export function leaderboardPlugin() {
  const install = server => {
    const api = createLeaderboardApi();
    server.middlewares.use(api.handler);
    server.httpServer?.once('close', () => api.close());
  };
  return { name: 'uptime-leaderboard', configureServer: install, configurePreviewServer: install };
}
