export const COMPANION_DURATIONS = Object.freeze({ sway: 4800, disco: 4400, wave: 5200, run: 2800, jump: 1800, slide: 5200 });
const DANCES = ['sway', 'disco', 'wave'];

export function chooseCompanionAction(previous, random = Math.random) {
  const choices = previous && !DANCES.includes(previous)
    ? DANCES : [...DANCES, ...DANCES, 'run', 'jump', 'slide'];
  const available = choices.filter(action => action !== previous);
  return available[Math.floor(random() * available.length)];
}

function segment(origin, length, degrees) {
  const angle = degrees * Math.PI / 180;
  return [origin[0] + length * Math.sin(angle), origin[1] + length * Math.cos(angle)];
}

function smooth(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function sampleCompanionPose(action, elapsedMs, sceneWidth = 400) {
  const p = Math.max(0, Math.min(1, elapsedMs / COMPANION_DURATIONS[action]));
  // Every phrase meets the same resting pose with zero velocity at its ends.
  const envelope = Math.sin(Math.PI * p) ** 2;
  const beat = p * Math.PI * (action === 'run' || action === 'slide' ? 16 : 8);
  const swing = Math.sin(beat) * envelope;
  const bounce = (1 - Math.cos(beat * 2)) * envelope;
  const center = sceneWidth / 2;
  const travel = Math.max(0, center - 56);
  let x = center + swing * 6;
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
    x = center + Math.sin(smooth(p) * Math.PI * 2) * travel;
    y -= bounce * 2;
    lean = Math.cos(p * Math.PI * 2) * envelope * 10;
    arms = [-55 + swing * 65, -25 - envelope * 65, 55 + swing * 65, 25 + envelope * 65];
    legs = [-12 + swing * 50, -8 + Math.max(0, -swing) * 85,
      12 - swing * 50, 8 - Math.max(0, swing) * 85];
  } else if (action === 'jump') {
    const lift = Math.sin(Math.PI * p) ** 4;
    x = center + Math.sin(p * Math.PI * 2) * envelope * 12;
    y = 91 - lift * 22;
    arms = [-55 - lift * 95, -25 - lift * 20, 55 + lift * 95, 25 + lift * 20];
    legs = [-12 - lift * 24, -8 + lift * 55, 12 + lift * 24, 8 - lift * 55];
  } else if (action === 'slide') {
    const kneel = smooth((p - 0.22) / 0.12) * (1 - smooth((p - 0.72) / 0.14));
    x = p < 0.25 ? center - travel * smooth(p / 0.25)
      : p < 0.8 ? center + travel * (2 * smooth((p - 0.25) / 0.55) - 1)
        : center + travel * (1 - smooth((p - 0.8) / 0.2));
    y = 91 + kneel * 17 - bounce * (1 - kneel) * 2;
    lean = swing * 9 * (1 - kneel) - kneel * 13;
    bend = swing * 10 * (1 - kneel) - kneel * 8;
    headTilt = -kneel * 12;
    arms = [-55 - swing * 50 - kneel * 75, -25, 55 - swing * 50 + kneel * 65, 25];
    legs = [-12 + swing * 45, -8 + Math.max(0, -swing) * 85,
      12 - swing * 45, 8 - Math.max(0, swing) * 85]
      .map((angle, i) => angle * (1 - kneel) + [-5, -100, 5, -110][i] * kneel);
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
    <g data-figure fill="none" stroke="currentColor" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round">
      <g data-parachute style="display:none" stroke-width="2">
        <path d="M -40 -75 Q 0 -125 40 -75 Q 20 -84 0 -75 Q -20 -84 -40 -75 Z" fill="#e9ba57"/>
        <path d="M -40 -75 L -12 -10 M 40 -75 L 12 -10 M 0 -75 L 0 -10"/>
      </g>
      <rect data-hit x="-35" y="-65" width="70" height="105" fill="transparent" stroke="none"
        role="button" tabindex="0" aria-label="Zatrzymaj ludzika. Przeciągnij, aby go podnieść."/>
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
  const figure = host.querySelector('[data-figure]');
  const hit = host.querySelector('[data-hit]');
  const parachute = host.querySelector('[data-parachute]');
  const events = new AbortController();
  host.removeAttribute('aria-hidden');
  svg.removeAttribute('aria-hidden');
  const parts = Object.fromEntries(Array.from(host.querySelectorAll('[data-part]'), node => [node.dataset.part, node]));
  let state = null;
  let raf = null;
  let previousTime = null;
  let elapsed = 0;
  let action = chooseCompanionAction(null, random);
  let pageHidden = false;
  let destroyed = false;
  let sceneWidth = 400;
  let pose = sampleCompanionPose('sway', 0);
  let stopped = false;
  let gesture = null;
  let falling = false;
  let offset = [0, 0];

  function place() {
    figure.setAttribute('transform', `translate(${offset[0]},${offset[1]})`);
    hit.setAttribute('x', pose.hip[0] - 35);
    hit.setAttribute('y', pose.hip[1] - 65);
    parachute.setAttribute('transform', `translate(${pose.head[0]},${pose.head[1]})`);
    parachute.style.display = falling ? '' : 'none';
    host.dataset.interaction = gesture ? 'held' : falling ? 'falling' : stopped ? 'stopped' : 'dancing';
    hit.setAttribute('aria-label', stopped ? 'Wznów ruch ludzika. Przeciągnij, aby go podnieść.' : 'Zatrzymaj ludzika. Przeciągnij, aby go podnieść.');
  }

  function draw(nextPose) {
    pose = nextPose;
    const point = p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    for (const name of ['leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
      parts[name].setAttribute('d', `M ${pose[name].map(point).join(' L ')}`);
    }
    parts.back.setAttribute('d', `M ${point(pose.hip)} C ${pose.back.map(point).join(' ')} ${point(pose.shoulder)}`);
    parts.head.setAttribute('transform', `translate(${point(pose.head)}) rotate(${pose.head[2].toFixed(2)})`);
    place();
  }

  function frame(timestamp) {
    raf = null;
    const delta = previousTime === null ? 0 : Math.min(50, Math.max(0, timestamp - previousTime));
    if (falling) {
      const ground = 127 - Math.max(pose.leftLeg[2][1], pose.rightLeg[2][1]);
      offset[1] = Math.min(ground, offset[1] + delta * 0.09);
      if (offset[1] >= ground) falling = false;
      previousTime = timestamp;
      place();
      sync();
      return;
    }
    elapsed += delta;
    previousTime = timestamp;
    if (elapsed >= COMPANION_DURATIONS[action]) {
      elapsed -= COMPANION_DURATIONS[action];
      action = chooseCompanionAction(action, random);
    }
    host.dataset.action = action;
    draw(sampleCompanionPose(action, elapsed, sceneWidth));
    raf = win.requestAnimationFrame(frame);
  }

  function sync() {
    if (destroyed) return;
    host.hidden = !state?.preferences.dancingCompanion;
    const visible = !host.hidden && !doc.hidden && !pageHidden && state.isWriter && !state.hasConflict
      && !state.isPaused && !state.activeDialog && !state.isWon && !state.victoryAnimation;
    svg.style.visibility = visible ? 'visible' : 'hidden';
    if ((!visible && (gesture || falling)) || (media.matches && falling)) {
      resetPosition();
    }
    const running = visible && !media.matches && !gesture && (!stopped || falling);
    host.dataset.running = String(running);
    if (!running) {
      if (raf !== null) win.cancelAnimationFrame(raf);
      raf = null;
      previousTime = null;
      if (visible && media.matches) draw(sampleCompanionPose('sway', 0, sceneWidth));
    } else if (raf === null) {
      raf = win.requestAnimationFrame(frame);
    }
  }

  function resetPosition() {
    const pointerId = gesture?.id;
    gesture = null;
    falling = false;
    offset = [0, 0];
    if (pointerId !== undefined && hit.hasPointerCapture(pointerId)) hit.releasePointerCapture(pointerId);
    place();
  }

  function toggle() {
    stopped = !stopped;
    falling = false;
    offset = [0, 0];
    place();
    sync();
  }

  hit.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || svg.style.visibility !== 'visible' || gesture) return;
    event.preventDefault();
    event.stopPropagation();
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, offset: [...offset], moved: false, wasStopped: stopped };
    falling = false;
    stopped = true;
    hit.setPointerCapture(event.pointerId);
    place();
    sync();
  }, { signal: events.signal });
  hit.addEventListener('pointermove', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture.moved ||= Math.hypot(dx, dy) > 6;
    if (!gesture.moved) return;
    const bounds = host.getBoundingClientRect();
    const scale = 140 / bounds.height;
    offset[0] = Math.max((40 - bounds.left) * scale - pose.hip[0],
      Math.min((win.innerWidth - 40 - bounds.left) * scale - pose.hip[0], gesture.offset[0] + dx * scale));
    offset[1] = Math.max((90 - bounds.top) * scale - pose.head[1],
      Math.min(127 - Math.max(pose.leftLeg[2][1], pose.rightLeg[2][1]), gesture.offset[1] + dy * scale));
    place();
  }, { signal: events.signal });
  function release(event) {
    if (gesture?.id !== event.pointerId) return;
    const held = gesture;
    gesture = null;
    if (event.type === 'pointerup' && !held.moved) {
      stopped = held.wasStopped;
      toggle();
    } else {
      falling = held.moved && !media.matches;
      if (!falling) offset = [0, 0];
      place();
      sync();
    }
    if (hit.hasPointerCapture(event.pointerId)) hit.releasePointerCapture(event.pointerId);
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) hit.addEventListener(type, release, { signal: events.signal });
  hit.addEventListener('click', event => event.stopPropagation(), { signal: events.signal });
  hit.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    toggle();
  }, { signal: events.signal });

  const hide = () => { pageHidden = true; sync(); };
  const show = () => { pageHidden = false; sync(); };
  doc.addEventListener('visibilitychange', sync);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  media.addEventListener('change', sync);
  const observer = new win.ResizeObserver(() => {
    if (destroyed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    resetPosition();
    sceneWidth = width * 140 / height;
    svg.setAttribute('viewBox', `0 0 ${sceneWidth} 140`);
    draw(sampleCompanionPose(media.matches ? 'sway' : action, media.matches ? 0 : elapsed, sceneWidth));
    sync();
  });
  observer.observe(host);
  draw(sampleCompanionPose('sway', 0));

  return {
    update(next) { state = next; sync(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      resetPosition();
      events.abort();
      if (raf !== null) win.cancelAnimationFrame(raf);
      doc.removeEventListener('visibilitychange', sync);
      win.removeEventListener('pagehide', hide);
      win.removeEventListener('pageshow', show);
      media.removeEventListener('change', sync);
      observer.disconnect();
      host.dataset.running = 'false';
      host.replaceChildren();
    },
  };
}
