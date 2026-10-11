import '../../src/styles.css';
import { createApp } from '../../src/app.js';
import { renderGame, renderProgressNotice } from '../../src/ui/render.js';
import { createInputController } from '../../src/ui/input.js';
import { fixtureSession, progressFixture } from '../fixtures/progress.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { restoreSession } from '../../src/persistence.js';
import diagnostic from '../fixtures/solitaire-stan-2284836135-draw1-114.json';

// Test-only entry: fixture boards still use the real session, controller and UI.
const params = new URLSearchParams(location.search);
const id = Number(params.get('fx') || 1);
const replay = params.has('replay') ? restoreSession(JSON.stringify(diagnostic.save)) : null;
if (replay && !replay.ok) throw new Error(`bad regression save: ${replay.reason}`);
const state = replay?.session.state || progressFixture(id, Number(params.get('draw') || 1));
const known = replay ? replay.session.knownCards : [...visibleCards(state), ...(id === 7 ? state.stock : [])];
const session = replay?.session || fixtureSession(state, known);
const app = createApp({
  storage: null,
  lockManager: null,
  load: () => ({ ok: true, session, metadata: { revision: 1, preferences: { drawCount: state.drawCount } } }),
  progressMaxStates: params.has('limit') ? Number(params.get('limit')) : 10000,
}).init();
const root = document.querySelector('#game-app');
const input = createInputController(app, root);
const render = () => renderGame(root, app.getState(), null, input, app);
input.onStateChange(render);
app.subscribe((state, progressOnly) => progressOnly ? renderProgressNotice(root, state) : render());
render();
window.fixtureApp = app;
window.fixtureInput = input;
