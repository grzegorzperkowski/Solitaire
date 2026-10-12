import '../../src/styles.css';
import { playVictoryAnimation } from '../../src/ui/victory-animation.js';

const root = document.getElementById('game-app');
let cleanup = null;
const app = {
  setVictoryAnimationCleanup(fn) { cleanup = fn; },
  finishVictoryAnimation() { cleanup?.(); cleanup = null; document.getElementById('result').hidden = false; },
};

for (const button of root.querySelectorAll('[data-preview]')) {
  button.addEventListener('click', () => {
    cleanup?.();
    document.getElementById('result').hidden = true;
    playVictoryAnimation(root, button.dataset.preview, app);
  });
}

root.querySelector('[data-preview="classic-cascade"]').click();

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') app.finishVictoryAnimation();
});
