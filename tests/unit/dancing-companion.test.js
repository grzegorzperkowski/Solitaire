import { describe, expect, test, vi } from 'vitest';
import { chooseCompanionAction, COMPANION_DURATIONS, createCompanionGestureDetector, createDancingCompanion, requestCompanionMotion, sampleCompanionPose } from '../../src/ui/dancing-companion.js';

describe('T035 phone gestures', () => {
  test('requires three alternating extremes, rejects noise, holds, fast jitter and stale cycles', () => {
    const detect = createCompanionGestureDetector(3);
    expect(detect(null, 0)).toBe(false);
    expect(detect(NaN, 0)).toBe(false);
    expect(detect(2, 0)).toBe(false);
    expect(detect(4, 0)).toBe(false);
    expect(detect(-4, 20)).toBe(false);
    expect(detect(4, 120)).toBe(false);
    expect(detect(-4, 240)).toBe(false);
    expect(detect(4, 400)).toBe(true);
    expect(detect(-4, 2000)).toBe(false);
    expect(detect(4, 2200)).toBe(false);
    expect(detect(-4, 2400)).toBe(true);
  });

  test('requests both permissions during the click, tolerates denial, errors and absent APIs', async () => {
    const motion = vi.fn(() => Promise.resolve('granted'));
    const orientation = vi.fn(() => Promise.resolve('granted'));
    const win = { DeviceMotionEvent: { requestPermission: motion }, DeviceOrientationEvent: { requestPermission: orientation } };
    const pending = requestCompanionMotion(win);
    expect(motion).toHaveBeenCalledTimes(1);
    expect(orientation).toHaveBeenCalledTimes(1);
    expect(await pending).toBe(true);
    orientation.mockResolvedValue('denied');
    expect(await requestCompanionMotion(win)).toBe(false);
    motion.mockImplementation(() => { throw new Error('blocked'); });
    expect(await requestCompanionMotion(win)).toBe(false);
    expect(await requestCompanionMotion({})).toBe(true);
  });
});

function sensor(h, type, data, time) {
  const event = new Event(type);
  Object.defineProperty(event, 'timeStamp', { value: time });
  Object.assign(event, data);
  h.win.dispatchEvent(event);
}

describe('T035 articulated companion', () => {
  test('random selection reaches every action, avoids repeats and separates run/jump with a dance', () => {
    const seen = new Set();
    for (const previous of [null, ...Object.keys(COMPANION_DURATIONS)]) {
      for (let i = 0; i < 100; i++) {
        const action = chooseCompanionAction(previous, () => i / 100);
        seen.add(action);
        expect(action).not.toBe(previous);
        if (previous && !['sway', 'disco', 'wave'].includes(previous)) expect(['sway', 'disco', 'wave']).toContain(action);
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

  test('knee slide lowers both knees to the floor, folds feet back and brakes before standing', () => {
    const duration = COMPANION_DURATIONS.slide;
    const slide = sampleCompanionPose('slide', duration * 0.55);
    expect(slide.hip[1]).toBeCloseTo(108);
    expect(slide.shoulder[0]).toBeLessThan(slide.hip[0]);
    for (const limb of [slide.leftLeg, slide.rightLeg]) {
      expect(limb[1][1]).toBeCloseTo(126, 0);
      expect(limb[2][0]).toBeLessThan(limb[1][0] - 15);
    }
    const advance = p => sampleCompanionPose('slide', duration * (p + 0.005)).hip[0]
      - sampleCompanionPose('slide', duration * p).hip[0];
    expect(advance(0.32)).toBeLessThan(advance(0.5));
    expect(advance(0.76)).toBeLessThan(advance(0.5));
  });

  test.each([509, 1420, 3054])('travel reaches both edges at scene width %i without stretching bones', (width) => {
    for (const action of ['run', 'slide']) {
      const positions = Array.from({ length: 201 }, (_, i) => sampleCompanionPose(action, COMPANION_DURATIONS[action] * i / 200, width));
      expect(Math.min(...positions.map(pose => pose.hip[0]))).toBeLessThan(60);
      expect(Math.max(...positions.map(pose => pose.hip[0]))).toBeGreaterThan(width - 60);
      for (const pose of positions) {
        for (const part of ['leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
          for (const [x, y] of pose[part]) {
            expect(x).toBeGreaterThan(1);
            expect(x).toBeLessThan(width - 1);
            expect(y).toBeGreaterThan(1);
            expect(y).toBeLessThan(139);
          }
        }
      }
    }
  });
});

function createHarness() {
  const media = Object.assign(new EventTarget(), { matches: false });
  const callbacks = new Map();
  let id = 0;
  let resize;
  const observer = { observe: vi.fn(), disconnect: vi.fn() };
  const win = Object.assign(new EventTarget(), {
    ResizeObserver: vi.fn(function (callback) { resize = callback; return observer; }),
    matchMedia: () => media,
    requestAnimationFrame: vi.fn(cb => { callbacks.set(++id, cb); return id; }),
    cancelAnimationFrame: vi.fn(key => callbacks.delete(key)),
  });
  const doc = Object.assign(new EventTarget(), { hidden: false, defaultView: win });
  const parts = Object.fromEntries(['head', 'back', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].map(part => [part, {
    dataset: { part }, setAttribute: vi.fn(),
  }]));
  const svg = { style: {}, setAttribute: vi.fn() };
  const host = {
    ownerDocument: doc, dataset: {}, hidden: true,
    querySelector: () => svg,
    querySelectorAll: () => Object.values(parts),
    replaceChildren: vi.fn(),
    getBoundingClientRect: () => ({ width: 1280, height: 88 }),
  };
  const companion = createDancingCompanion(host, () => 0.85);
  const state = { preferences: { dancingCompanion: true }, isWriter: true };
  function tick(time) {
    const pending = [...callbacks.values()];
    callbacks.clear();
    pending.forEach(cb => cb(time));
  }
  return { companion, host, doc, win, media, callbacks, parts, svg, state, tick, resize, observer };
}

describe('T035 companion lifecycle', () => {
  test.each([0, 90, 180, 270])('screen-relative shake jumps and cyclic tilt sways at %i degrees', (angle) => {
    const h = createHarness();
    h.win.screen = { orientation: { angle } };
    h.companion.update(h.state);
    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    // Select a dance first, so the jump must come from the sensor.
    for (let time = 0; time <= 1900; time += 50) h.tick(time);
    expect(h.host.dataset.action).not.toBe('jump');
    [5, -5, 5].forEach((value, i) => sensor(h, 'devicemotion', {
      acceleration: { x: -value * sin, y: value * cos },
    }, i * 200));
    h.tick(2000);
    expect(h.host.dataset.action).toBe('jump');
    for (let time = 2050; time <= 3900; time += 50) {
      if (time <= 3500 && time % 200 === 0) sensor(h, 'devicemotion', {
        acceleration: { x: -(time % 400 === 0 ? 5 : -5) * sin, y: (time % 400 === 0 ? 5 : -5) * cos },
      }, time);
      h.tick(time);
    }
    expect(h.host.dataset.action).not.toBe('jump');
    [20, -20, 20].forEach((value, i) => sensor(h, 'deviceorientation', {
      gamma: value * cos, beta: value * sin,
    }, 4000 + i * 200));
    h.tick(4500);
    expect(h.host.dataset.action).toBe('sway');
    h.companion.destroy();
  });

  test('gravity fallback detects shaking; missing data, pause, reduced motion and destroy ignore sensors', () => {
    const h = createHarness();
    h.companion.update(h.state);
    for (let time = 0; time <= 1900; time += 50) h.tick(time);
    sensor(h, 'devicemotion', { acceleration: { x: null, y: null } }, 0);
    sensor(h, 'deviceorientation', { beta: null, gamma: null }, 0);
    [9.8, 15, 4, 15].forEach((y, i) => sensor(h, 'devicemotion', {
      acceleration: null, accelerationIncludingGravity: { x: 0, y },
    }, i * 200));
    h.tick(2000);
    expect(h.host.dataset.action).toBe('jump');
    h.companion.update({ ...h.state, isPaused: true });
    [20, -20, 20].forEach((gamma, i) => sensor(h, 'deviceorientation', { beta: 0, gamma }, 3000 + i * 200));
    h.companion.update(h.state);
    h.tick(4000);
    expect(h.host.dataset.action).toBe('jump');
    h.media.matches = true;
    h.media.dispatchEvent(new Event('change'));
    [20, -20, 20].forEach((gamma, i) => sensor(h, 'deviceorientation', { beta: 0, gamma }, 5000 + i * 200));
    expect(h.callbacks.size).toBe(0);
    const remove = vi.spyOn(h.win, 'removeEventListener');
    h.companion.destroy();
    expect(remove).toHaveBeenCalledWith('devicemotion', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('deviceorientation', expect.any(Function));
  });

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
    expect(h.observer.disconnect).toHaveBeenCalledTimes(1);
  });

  test('resizing expands the scene width while keeping a uniformly scaled figure', () => {
    const h = createHarness();
    h.companion.update(h.state);
    h.resize();
    expect(h.svg.setAttribute).toHaveBeenLastCalledWith('viewBox', `0 0 ${1280 * 140 / 88} 140`);
    h.host.getBoundingClientRect = () => ({ width: 320, height: 88 });
    h.resize();
    expect(h.svg.setAttribute).toHaveBeenLastCalledWith('viewBox', `0 0 ${320 * 140 / 88} 140`);
    expect(h.callbacks.size).toBe(1);
    h.companion.destroy();
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
