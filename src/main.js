import './styles.css';
import { createApp } from './app.js';
import { renderGame, renderProgressNotice, checkScrollerOverflow } from './ui/render.js';
import { setupResponsiveLayout } from './ui/layout.js';
import { createInputController } from './ui/input.js';
import { playVictoryAnimation } from './ui/victory-animation.js';
import { createDancingCompanion } from './ui/dancing-companion.js';

const app = createApp();

if (typeof window !== 'undefined') {
  window.__SOLITAIRE_APP__ = app;
  window.__SOLITAIRE_RENDER__ = renderGame;
    if (import.meta.env.DEV) {
      window.__SOLITAIRE_VICTORY_PREVIEW__ = (type) => {
        window.__SOLITAIRE_VICTORY_CANCEL__?.();
        const previewApp = {
          finishVictoryAnimation: () => window.__SOLITAIRE_VICTORY_CANCEL__?.(),
          setVictoryAnimationCleanup: (cleanup) => { window.__SOLITAIRE_VICTORY_CANCEL__ = cleanup; },
        };
        return playVictoryAnimation(document.getElementById('game-app'), type, previewApp);
      };
      window.__SOLITAIRE_VICTORY_CANCEL__ = null;
    }
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
      renderGame(root, app.getState(), currentDims, inputCtrl, app);
    });

    setupResponsiveLayout(root, (dims) => {
      currentDims = dims;
      renderGame(root, app.getState(), currentDims, inputCtrl, app);
    });

    renderGame(root, app.getState(), currentDims, inputCtrl, app);

    const companion = createDancingCompanion(root.querySelector('#dancing-companion'));
    companion.update(app.getState());
    const scrollerObserver = new ResizeObserver(() => checkScrollerOverflow(root));
    scrollerObserver.observe(root.querySelector('#tableau-scroller'));
    app.setDancingCompanionCleanup(() => {
      companion.destroy();
      scrollerObserver.disconnect();
    });

    app.subscribe((state, progressOnly) => {
      companion.update(state);
      if (progressOnly) {
        renderProgressNotice(root, state);
        return;
      }
      renderGame(root, state, currentDims, inputCtrl, app);
    });
  }
}
