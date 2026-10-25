import { describe, expect, test, vi } from 'vitest';
import { chooseCompanionAction, COMPANION_DURATIONS, createDancingCompanion, sampleCompanionPose } from '../../src/ui/dancing-companion.js';

describe('T035 articulated companion', () => {
  test('random selection reaches every action, avoids repeats and separates run/jump with a dance', () => {
    const seen = new Set();
    for (const previous of [null, ...Object.keys(COMPANION_DURATIONS)]) {
      for (let i = 0; i < 100; i++) {
        const action = chooseCompanionAction(previous, () => i / 100);
        seen.add(action);
        expect(action).not.toBe(previous);
        if (previous === 'run' || previous === 'jump') expect(['sway', 'disco', 'wave']).toContain(action);
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(COMPANION_DURATIONS).sort());
  });

  test.each(Object.entries(COMPANION_DURATIONS))('%s keeps joints attached and fixed-length bones within the stage', (action, duration) => {
    const resting = sampleCompanionPose('sway', 0);
    const restValues = Object.values(resting).flat(Infinity);
    for (const time of [0, duration]) {
      Object.values(sampleCompanionPose(action, time)).flat(Infinity)
        .forEach((n, i) => expect(n).toBeCloseTo(restValues[i], 8));
    }
    const changes = new Set();
    for (let ms = 0; ms <= duration; ms += 1000 / 60) {
      const pose = sampleCompanionPose(action, ms);
      for (const key of ['leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
        const limb = pose[key];
        const lengths = key.endsWith('Arm') ? [17, 16] : [18, 18];
        for (let i = 1; i < 3; i++) {
          expect(Math.hypot(limb[i][0] - limb[i - 1][0], limb[i][1] - limb[i - 1][1])).toBeCloseTo(lengths[i - 1], 8);
        }
        if (key.endsWith('Leg')) expect(limb[0]).toEqual(pose.hip);
        else expect(limb[0][1]).toBe(pose.shoulder[1] + 1);
        for (const [x, y] of limb) {
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          expect(x).toBeGreaterThan(2);
          expect(x).toBeLessThan(398);
          expect(y).toBeGreaterThan(2);
          expect(y).toBeLessThan(138);
        }
        if (Math.hypot(limb[2][0] - resting[key][2][0], limb[2][1] - resting[key][2][1]) > 2) changes.add(key);
      }
      expect(pose.head[1] - 15).toBeGreaterThan(0);
    }
    expect(changes.size).toBe(4);
  });

  test('running travels, jumping lifts, and dancing bends the back and tilts the head', () => {
    const rest = sampleCompanionPose('sway', 0);
    expect(Math.abs(sampleCompanionPose('run', 1000).hip[0] - rest.hip[0])).toBeGreaterThan(40);
    expect(sampleCompanionPose('jump', 900).hip[1]).toBeLessThan(rest.hip[1] - 20);
    const dance = sampleCompanionPose('disco', 900);
    expect(dance.back[0][0]).not.toBe(dance.hip[0]);
    expect(Math.abs(dance.head[2])).toBeGreaterThan(1);
  });
});

function createHarness() {
  const media = Object.assign(new EventTarget(), { matches: false });
  const callbacks = new Map();
  let id = 0;
  const win = Object.assign(new EventTarget(), {
    matchMedia: () => media,
    requestAnimationFrame: vi.fn(cb => { callbacks.set(++id, cb); return id; }),
    cancelAnimationFrame: vi.fn(key => callbacks.delete(key)),
  });
  const doc = Object.assign(new EventTarget(), { hidden: false, defaultView: win });
  const parts = Object.fromEntries(['head', 'back', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].map(part => [part, {
    dataset: { part }, setAttribute: vi.fn(),
  }]));
  const svg = { style: {} };
  const host = {
    ownerDocument: doc, dataset: {}, hidden: true,
    querySelector: () => svg,
    querySelectorAll: () => Object.values(parts),
    replaceChildren: vi.fn(),
  };
  const companion = createDancingCompanion(host, () => 0.99);
  const state = { preferences: { dancingCompanion: true }, isWriter: true };
  function tick(time) {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach(cb => cb(time));
  }
  return { companion, host, doc, win, media, callbacks, parts, svg, state, tick };
}

describe('T035 companion lifecycle', () => {
  test('one RAF across updates, zero timestamp works, resumed time excludes hidden duration', () => {
    const h = createHarness();
    h.companion.update(h.state);
    h.companion.update(h.state);
    expect(h.callbacks.size).toBe(1);
    h.tick(0);
    h.tick(20);
    const before = h.parts.back.setAttribute.mock.lastCall;
    h.doc.hidden = true;
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(h.callbacks.size).toBe(0);
    h.doc.hidden = false;
    h.doc.dispatchEvent(new Event('visibilitychange'));
    h.tick(20000);
    expect(h.parts.back.setAttribute.mock.lastCall).toEqual(before);
    h.tick(20020);
    expect(h.parts.back.setAttribute.mock.lastCall).not.toEqual(before);
    h.companion.destroy();
    expect(h.callbacks.size).toBe(0);
  });

  test.each([
    { isPaused: true }, { activeDialog: 'menu' }, { isWriter: false }, { hasConflict: true },
    { isWon: true }, { victoryAnimation: 'cascade' }, { preferences: { dancingCompanion: false } },
  ])('stops when inactive: %j', (change) => {
    const h = createHarness();
    h.companion.update(h.state);
    h.tick(0);
    h.companion.update({ ...h.state, ...change });
    expect(h.callbacks.size).toBe(0);
    expect(h.svg.style.visibility).toBe('hidden');
    h.companion.update(h.state);
    expect(h.callbacks.size).toBe(1);
    h.companion.destroy();
  });

  test('reduced motion is static, bfcache resumes safely, destroy removes every listener', () => {
    const h = createHarness();
    h.companion.update(h.state);
    h.media.matches = true;
    h.media.dispatchEvent(new Event('change'));
    expect(h.callbacks.size).toBe(0);
    expect(h.svg.style.visibility).toBe('visible');
    h.media.matches = false;
    h.media.dispatchEvent(new Event('change'));
    expect(h.callbacks.size).toBe(1);
    h.win.dispatchEvent(new Event('pagehide'));
    h.companion.update(h.state);
    expect(h.callbacks.size).toBe(0);
    h.win.dispatchEvent(new Event('pageshow'));
    expect(h.callbacks.size).toBe(1);
    h.companion.destroy();
    h.companion.destroy();
    h.doc.dispatchEvent(new Event('visibilitychange'));
    h.win.dispatchEvent(new Event('pageshow'));
    h.media.dispatchEvent(new Event('change'));
    h.companion.update(h.state);
    expect(h.callbacks.size).toBe(0);
    expect(h.host.replaceChildren).toHaveBeenCalledTimes(1);
  });

  test('phrase scheduler changes actions at their boundaries without duplicate RAFs', () => {
    const h = createHarness();
    h.companion.update(h.state);
    h.tick(0);
    expect(h.host.dataset.action).toBe('jump');
    for (let ms = 50; ms <= 1850; ms += 50) h.tick(ms);
    expect(['sway', 'disco', 'wave']).toContain(h.host.dataset.action);
    expect(h.callbacks.size).toBe(1);
    h.companion.destroy();
  });
});
