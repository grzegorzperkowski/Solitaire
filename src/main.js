import './styles.css';
import { createApp } from './app.js';
import { renderGame } from './ui/render.js';
import { setupResponsiveLayout } from './ui/layout.js';
import { createInputController } from './ui/input.js';

const app = createApp();

if (typeof window !== 'undefined') {
  window.__SOLITAIRE_APP__ = app;
  window.__SOLITAIRE_RENDER__ = renderGame;
}

app.init();

if (typeof document !== 'undefined') {
  const root = document.getElementById('game-app');
  if (root) {
    let currentDims = null;
    const inputCtrl = createInputController(app, root);

    if (typeof window !== 'undefined') {
      window.__SOLITAIRE_INPUT__ = inputCtrl;
    }

    inputCtrl.onStateChange(() => {
      renderGame(root, app.getState(), currentDims, inputCtrl);
    });

    setupResponsiveLayout(root, (dims) => {
      currentDims = dims;
      renderGame(root, app.getState(), currentDims, inputCtrl);
    });

    renderGame(root, app.getState(), currentDims, inputCtrl);

    app.subscribe((state) => {
      renderGame(root, state, currentDims, inputCtrl);
    });
  }
}
