import { readFileSync } from 'node:fs';
import { createSession, execute, setElapsedMs } from '../../src/session.js';
import { serializeSession } from '../../src/persistence.js';

// Frozen legal traces from the existing CI simulation: seeds 827/Draw 1 and 681/Draw 3.
export function nearWin(drawCount = 1) {
  const trace = JSON.parse(readFileSync(new URL(`win-draw${drawCount}.json`, import.meta.url)));
  let session = createSession({ seed: trace.seed, drawCount }, `near-win-draw-${drawCount}`);
  for (const command of trace.commands.slice(0, -1)) {
    const result = execute(session, command);
    if (!result.ok) throw new Error('Invalid winning trace');
    session = result.session;
  }
  session = setElapsedMs(session, 12000);
  return {
    session,
    command: trace.commands.at(-1),
    save: serializeSession(session, { preferences: { drawCount, touchHelpSeen: true } }),
  };
}
