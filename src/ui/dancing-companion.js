export const COMPANION_DURATIONS = Object.freeze({ sway: 4800, disco: 4400, wave: 5200, run: 2800, jump: 1800 });
const DANCES = ['sway', 'disco', 'wave'];

export function chooseCompanionAction(previous, random = Math.random) {
  const choices = previous === 'run' || previous === 'jump'
    ? DANCES : [...DANCES, ...DANCES, 'run', 'jump'];
  const available = choices.filter(action => action !== previous);
  return available[Math.floor(random() * available.length)];
}

function segment(origin, length, degrees) {
  const angle = degrees * Math.PI / 180;
  return [origin[0] + length * Math.sin(angle), origin[1] + length * Math.cos(angle)];
}

export function sampleCompanionPose(action, elapsedMs) {
  const p = Math.max(0, Math.min(1, elapsedMs / COMPANION_DURATIONS[action]));
  // Every phrase meets the same resting pose with zero velocity at its ends.
  const envelope = Math.sin(Math.PI * p) ** 2;
  const beat = p * Math.PI * (action === 'run' ? 16 : 8);
  const swing = Math.sin(beat) * envelope;
  const bounce = (1 - Math.cos(beat * 2)) * envelope;
  let x = 200 + swing * 6;
  let y = 91 - bounce * 2;
  let lean = swing * 9;
  let bend = swing * 10;
  let headTilt = -swing * 12;
  let arms = [-55 - swing * 50, -25, 55 - swing * 50, 25];
  let legs = [-12 - swing * 12, -8 + bounce * 12, 12 - swing * 12, 8 - bounce * 12];

  if (action === 'disco') {
    arms = [-55 - envelope * 90 - swing * 25, -25 - swing * 30, 55 + swing * 65, 25 + bounce * 20];
    lean = -swing * 12;
    bend = swing * 16;
  } else if (action === 'wave') {
    arms = [-55 - envelope * 95 + swing * 25, -25 + swing * 55,
      55 + envelope * 95 + swing * 25, 25 + Math.sin(beat + 1) * envelope * 55];
    y += bounce * 2;
    headTilt = swing * 18;
  } else if (action === 'run') {
    x = 200 + Math.sin(p * Math.PI * 2) * envelope * 105;
    y -= bounce * 2;
    lean = Math.cos(p * Math.PI * 2) * envelope * 10;
    arms = [-55 + swing * 65, -25 - envelope * 65, 55 + swing * 65, 25 + envelope * 65];
    legs = [-12 + swing * 50, -8 + Math.max(0, -swing) * 85,
      12 - swing * 50, 8 - Math.max(0, swing) * 85];
  } else if (action === 'jump') {
    const lift = Math.sin(Math.PI * p) ** 4;
    x = 200 + Math.sin(p * Math.PI * 2) * envelope * 12;
    y = 91 - lift * 22;
    arms = [-55 - lift * 95, -25 - lift * 20, 55 + lift * 95, 25 + lift * 20];
    legs = [-12 - lift * 24, -8 + lift * 55, 12 + lift * 24, 8 - lift * 55];
  }

  const hip = [x, y];
  const shoulder = [x + lean, y - 36];
  const leftShoulder = [shoulder[0] - 3, shoulder[1] + 1];
  const rightShoulder = [shoulder[0] + 3, shoulder[1] + 1];
  const leftElbow = segment(leftShoulder, 17, arms[0]);
  const rightElbow = segment(rightShoulder, 17, arms[2]);
  const leftKnee = segment(hip, 18, legs[0]);
  const rightKnee = segment(hip, 18, legs[2]);
  return {
    hip, shoulder,
    back: [[x + bend, y - 12], [shoulder[0] - bend, shoulder[1] + 12]],
    head: [shoulder[0], shoulder[1] - 15, headTilt],
    leftArm: [leftShoulder, leftElbow, segment(leftElbow, 16, arms[0] + arms[1])],
    rightArm: [rightShoulder, rightElbow, segment(rightElbow, 16, arms[2] + arms[3])],
    leftLeg: [hip, leftKnee, segment(leftKnee, 18, legs[0] + legs[1])],
    rightLeg: [hip, rightKnee, segment(rightKnee, 18, legs[2] + legs[3])],
  };
}

export function createDancingCompanion(host, random = Math.random) {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const media = win.matchMedia('(prefers-reduced-motion: reduce)');
  host.innerHTML = `<svg viewBox="0 0 400 140" aria-hidden="true" focusable="false">
    <g fill="none" stroke="currentColor" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round">
      <path data-part="leftLeg"/><path data-part="rightLeg"/>
      <path data-part="back"/><path data-part="leftArm"/><path data-part="rightArm"/>
      <g data-part="head">
        <path d="M -13 0 C -14 -18 13 -18 14 -1 C 16 17 -13 18 -13 0 Z"/>
        <ellipse cx="-5" cy="-3" rx="2.2" ry="2.8" stroke-width="1.7"/>
        <ellipse cx="5" cy="-3" rx="2.2" ry="2.8" stroke-width="1.7"/>
        <path d="M -6 5 Q 0 12 7 4" stroke-width="1.9"/>
      </g>
    </g>
  </svg>`;
  const svg = host.querySelector('svg');
  const parts = Object.fromEntries(Array.from(host.querySelectorAll('[data-part]'), node => [node.dataset.part, node]));
  let state = null;
  let raf = null;
  let previousTime = null;
  let elapsed = 0;
  let action = chooseCompanionAction(null, random);
  let pageHidden = false;
  let destroyed = false;

  function draw(pose) {
    const point = p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    for (const name of ['leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
      parts[name].setAttribute('d', `M ${pose[name].map(point).join(' L ')}`);
    }
    parts.back.setAttribute('d', `M ${point(pose.hip)} C ${pose.back.map(point).join(' ')} ${point(pose.shoulder)}`);
    parts.head.setAttribute('transform', `translate(${point(pose.head)}) rotate(${pose.head[2].toFixed(2)})`);
  }

  function frame(timestamp) {
    raf = null;
    if (previousTime !== null) elapsed += Math.min(50, Math.max(0, timestamp - previousTime));
    previousTime = timestamp;
    if (elapsed >= COMPANION_DURATIONS[action]) {
      elapsed -= COMPANION_DURATIONS[action];
      action = chooseCompanionAction(action, random);
    }
    host.dataset.action = action;
    draw(sampleCompanionPose(action, elapsed));
    raf = win.requestAnimationFrame(frame);
  }

  function sync() {
    if (destroyed) return;
    host.hidden = !state?.preferences.dancingCompanion;
    const visible = !host.hidden && !doc.hidden && !pageHidden && state.isWriter && !state.hasConflict
      && !state.isPaused && !state.activeDialog && !state.isWon && !state.victoryAnimation;
    svg.style.visibility = visible ? 'visible' : 'hidden';
    const running = visible && !media.matches;
    host.dataset.running = String(running);
    if (!running) {
      if (raf !== null) win.cancelAnimationFrame(raf);
      raf = null;
      previousTime = null;
      if (visible) draw(sampleCompanionPose('sway', 0));
    } else if (raf === null) {
      raf = win.requestAnimationFrame(frame);
    }
  }

  const hide = () => { pageHidden = true; sync(); };
  const show = () => { pageHidden = false; sync(); };
  doc.addEventListener('visibilitychange', sync);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  media.addEventListener('change', sync);
  draw(sampleCompanionPose('sway', 0));

  return {
    update(next) { state = next; sync(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf !== null) win.cancelAnimationFrame(raf);
      doc.removeEventListener('visibilitychange', sync);
      win.removeEventListener('pagehide', hide);
      win.removeEventListener('pageshow', show);
      media.removeEventListener('change', sync);
      host.dataset.running = 'false';
      host.replaceChildren();
    },
  };
}
