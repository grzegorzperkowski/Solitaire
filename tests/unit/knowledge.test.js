import { expect, test } from 'vitest';
import { createSession, execute, undo, redo, restartSession, setElapsedMs } from '../../src/session.js';
import { serializeSession, restoreSession } from '../../src/persistence.js';
import { visibleCards } from '../../src/engine/knowledge.js';
import { getLegalMoves } from '../../src/engine/game.js';

test.each([1, 3])('knowledge survives Undo, branching, time and reload in Draw %s', (drawCount) => {
  const initial = createSession({ seed: 42, drawCount });
  expect(initial.knownCards).toEqual([...visibleCards(initial.state)].sort((a, b) => a - b));
  const drawn = execute(initial, { type: 'draw' }).session;
  for (const id of initial.state.stock.slice(-drawCount)) expect(drawn.knownCards).toContain(id);
  const undone = undo(drawn);
  expect(undone.knownCards).toEqual(drawn.knownCards);
  expect(redo(undone).knownCards).toEqual(drawn.knownCards);
  expect(setElapsedMs(undone, 100).knownCards).toEqual(drawn.knownCards);
  const text = serializeSession(undone);
  expect(JSON.parse(text).schemaVersion).toBe(2);
  expect(restoreSession(text).session.knownCards).toEqual(drawn.knownCards);
  expect(restartSession(undone).knownCards).toEqual(initial.knownCards);
  const branch = getLegalMoves(undone.state).find((move) => move.type === 'move');
  const branched = execute(undone, branch).session;
  for (const id of drawn.knownCards) expect(branched.knownCards).toContain(id);
  expect(branched.commands).toEqual([branch]);
  expect(restoreSession(serializeSession(branched)).session.knownCards).toEqual(branched.knownCards);
});

test('legacy v1 migrates conservatively, ignoring claimed knowledge', () => {
  let session = createSession({ seed: 42, drawCount: 3 });
  session = undo(execute(session, { type: 'draw' }).session);
  const save = JSON.parse(serializeSession(session));
  save.schemaVersion = 1;
  save.session.knownCards = Array.from({ length: 52 }, (_, i) => i);
  const restored = restoreSession(JSON.stringify(save));
  expect(restored.ok).toBe(true);
  expect(restored.session.knownCards).toEqual([...visibleCards(session.state)].sort((a, b) => a - b));
});

test.each([null, [], [52], [-1], [1.5], ['1'], [1, 1], Array(53).fill(0)].map((value) => [value]))('rejects malformed/incomplete v2 knowledge %j', (knownCards) => {
  const save = JSON.parse(serializeSession(createSession({ seed: 42, drawCount: 1 })));
  save.session.knownCards = knownCards;
  expect(restoreSession(JSON.stringify(save))).toMatchObject({ ok: false, reason: 'invalid-session' });
});

test('v2 requires knowledge field', () => {
  const save = JSON.parse(serializeSession(createSession({ seed: 42, drawCount: 1 })));
  delete save.session.knownCards;
  expect(restoreSession(JSON.stringify(save)).ok).toBe(false);
});
