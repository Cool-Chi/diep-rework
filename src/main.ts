import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    throw new Error('Root #app container not found.');
  }

  const game = new Game();
  if (import.meta.env.DEV) {
    (window as unknown as { __game?: Game }).__game = game;
  }
  await game.init(appContainer);
});
