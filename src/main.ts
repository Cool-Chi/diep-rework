import { Game } from './core/Game';

window.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    throw new Error('Root #app container not found.');
  }

  const game = new Game();
  await game.init(appContainer);
});
