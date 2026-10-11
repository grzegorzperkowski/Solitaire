export function createTestEnvelope({
  schemaVersion = 1,
  revision = 1,
  savedAt = '2026-10-10T12:00:00.000Z',
  preferences = { drawCount: 1, touchHelpSeen: false },
  statistics = {
    draw1: { attempts: 3, wins: 1, bestTimeMs: 45000, fewestMoves: 82 },
    draw3: { attempts: 0, wins: 0, bestTimeMs: null, fewestMoves: null },
  },
  session = {
    attemptId: 'test-attempt-uuid-1234',
    options: {
      seed: 42,
      drawCount: 1,
      rulesVersion: 1,
      shuffleVersion: 1,
    },
    commands: [],
    cursor: 0,
    elapsedMs: 12000,
    started: false,
    winRecorded: false,
  },
} = {}) {
  return {
    schemaVersion,
    revision,
    savedAt,
    preferences,
    statistics,
    session,
  };
}

export const CORRUPT_JSON = '{"schemaVersion": 1, "revision": 1, "savedAt": "broken...';

export const UNSUPPORTED_VERSION_SAVE = JSON.stringify(
  createTestEnvelope({ schemaVersion: 99 })
);

export const INVALID_REPLAY_SAVE = JSON.stringify(
  createTestEnvelope({
    session: {
      attemptId: 'test-invalid-replay',
      options: { seed: 42, drawCount: 1, rulesVersion: 1, shuffleVersion: 1 },
      commands: [
        { type: 'move', from: { pile: 'tableau', index: 0, cardIndex: 0 }, to: { pile: 'foundation', index: 0 } },
      ],
      cursor: 1,
      elapsedMs: 1000,
      started: true,
      winRecorded: false,
    },
  })
);
