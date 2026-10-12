import { VICTORY_ANIMATIONS } from './victory-bag.js';
import { createCardElement } from './cards.js';

const SUITS = ['♣', '♦', '♥', '♠'];
const RED = ['#202020', '#d32f2f', '#d32f2f', '#202020'];

export { VICTORY_ANIMATIONS };

export function playVictoryAnimation(root, type, app) {
  const old = root._victoryEffect;
  old?.cancel();
  if (!VICTORY_ANIMATIONS.includes(type)) throw new Error('Unknown victory animation');

  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const overlay = doc.createElement('div');
  overlay.className = 'victory-animation';
  overlay.dataset.animation = type;
  overlay.innerHTML = '<canvas aria-hidden="true"></canvas><p class="victory-animation-title" aria-hidden="true">Zwycięstwo!</p><p class="sr-only" role="status" aria-live="assertive">Zwycięstwo!</p><button type="button" class="victory-skip">Pomiń</button>';
  root.append(overlay);
  const canvas = overlay.querySelector('canvas');
  let ctx;
  try { ctx = canvas.getContext('2d'); } catch { overlay.remove(); throw new Error('Canvas unavailable'); }
  if (!ctx) { overlay.remove(); app.finishVictoryAnimation(); return () => {}; }

  const cardW = Math.min(78, Math.max(43, win.innerWidth * 0.13));
  const cardH = cardW * 1.4;
  const startPoints = Array.from({ length: 4 }, (_, i) => {
    const rect = root.querySelector(`#foundation-${i}`)?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: win.innerWidth * (0.39 + i * 0.075), y: win.innerHeight * 0.2 };
  });
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const duration = type === 'classic-cascade' ? 6000 : type === 'card-tornado' ? 4700 : type === 'suit-fireworks' ? 3600 : 2800;
  const particles = type === 'suit-fireworks' ? Array.from({ length: 72 }, (_, i) => ({
    angle: (i / 72) * Math.PI * 2,
    speed: 100 + ((i * 47) % 190),
    size: 13 + (i % 17),
    suit: i % 4,
    burst: i % 7,
  })) : [];
  let raf = 0;
  let start = null;
  let cancelled = false;
  const fanCards = type === 'magic-fan' ? startPoints.map((point, i) => {
    const card = createCardElement(12 + i * 13);
    card.classList.add('victory-fan-card');
    card.setAttribute('aria-hidden', 'true');
    card.removeAttribute('role');
    card.removeAttribute('aria-label');
    card.style.width = `${cardW}px`;
    card.style.height = `${cardH}px`;
    card.style.left = `${point.x - cardW / 2}px`;
    card.style.top = `${point.y - cardH / 2}px`;
    overlay.append(card);
    return card;
  }) : [];

  function resize() {
    const dpr = Math.min(win.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(win.innerWidth * dpr);
    canvas.height = Math.round(win.innerHeight * dpr);
    canvas.style.width = `${win.innerWidth}px`;
    canvas.style.height = `${win.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawCard(x, y, angle, scale, suit, rank) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(0,0,0,.42)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fffff8';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-cardW / 2, -cardH / 2, cardW, cardH);
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = RED[suit];
    ctx.font = `bold ${Math.max(13, cardW * .27)}px system-ui`;
    ctx.fillText(`${rank}${SUITS[suit]}`, -cardW * .4, -cardH * .3);
    ctx.font = `${Math.max(20, cardW * .56)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(SUITS[suit], 0, cardH * .12);
    ctx.restore();
  }

  function frame(timestamp) {
    if (cancelled) return;
    if (start === null) start = timestamp;
    const t = Math.min((timestamp - start) / duration, 1);
    const w = win.innerWidth, h = win.innerHeight, cx = w / 2, cy = h * .43;
    if (type === 'classic-cascade') {
      ctx.fillStyle = 'rgba(12, 36, 29, .12)';
      ctx.fillRect(0, 0, w, h);
      const count = Math.floor(t * 42);
      for (let i = 0; i < count; i++) {
        const age = t * duration / 1000 - i * .12;
        if (age < 0 || age > 2.8) continue;
        const point = startPoints[i % 4];
        const vx = (i % 2 ? 1 : -1) * (95 + i % 5 * 34);
        const floor = h - cardH / 2;
        let x = point.x, y = point.y, vy = -(235 + i % 7 * 14), remaining = age;
        for (let bounce = 0; bounce < 8 && remaining > 0; bounce++) {
          const toFloor = (-vy + Math.sqrt(vy * vy + 2 * 680 * Math.max(0, floor - y))) / 680;
          if (toFloor >= remaining) {
            x += vx * remaining;
            y += vy * remaining + 340 * remaining * remaining;
            remaining = 0;
          } else {
            x += vx * toFloor;
            y = floor;
            remaining -= toFloor;
            vy = -(vy + 680 * toFloor) * .68;
          }
        }
        drawCard(x, y, age * (i % 2 ? 2.4 : -2.2), 0.82, i % 4, 1 + i % 13);
      }
    } else {
      ctx.clearRect(0, 0, w, h);
      if (type === 'magic-fan') {
        startPoints.forEach((p, i) => {
          const e = Math.min(1, Math.max(0, (t * 1.4 - i * .09) / .72));
          const ease = 1 - (1 - e) ** 3;
          const offsets = [-1.35, -.45, .45, 1.35];
          const x = p.x + (cx + offsets[i] * cardW * 1.15 - p.x) * ease;
          const y = p.y + (cy - cardH * .2 - p.y) * ease;
          fanCards[i].style.transform = `translate3d(${x - p.x}px,${y - p.y}px,0) perspective(650px) rotateY(${Math.sin(ease * Math.PI * 2) * 155}deg) rotate(${offsets[i] * ease}rad) scale(${.8 + ease * .2})`;
        });
        if (t > .72) {
          ctx.fillStyle = `rgba(245, 214, 128, ${.18 + Math.sin(t * 22) * .06})`;
          ctx.beginPath(); ctx.arc(cx, cy, cardW * 2.1, 0, Math.PI * 2); ctx.fill();
        }
      } else if (type === 'suit-fireworks') {
        const burstPoints = [...startPoints, { x: w * .25, y: h * .2 }, { x: w * .75, y: h * .2 }, { x: cx, y: h * .16 }];
        particles.forEach((p, i) => {
          const phase = (t * 1.4 + p.burst * .17) % 1;
          const origin = burstPoints[p.burst % burstPoints.length];
          const x = origin.x + Math.cos(p.angle + p.burst) * p.speed * phase;
          const y = origin.y + Math.sin(p.angle + p.burst) * p.speed * phase + 120 * phase * phase;
          ctx.globalAlpha = Math.max(0, 1 - phase);
          ctx.fillStyle = p.suit === 1 || p.suit === 2 ? RED[p.suit] : '#fff8e4';
          ctx.font = `bold ${p.size}px system-ui`;
          ctx.save(); ctx.translate(x, y); ctx.rotate(phase * (i % 2 ? 4 : -4)); ctx.fillText(SUITS[p.suit], 0, 0); ctx.restore();
        });
        ctx.globalAlpha = 1;
      } else {
        const count = 32;
        for (let i = 0; i < count; i++) {
          const phase = t;
          const theta = i * .78 + phase * (5 + i % 3);
          const radius = (Math.max(0, 1 - Math.abs(phase - .58) * 1.5) * (w * .43)) * (1 - phase * .42);
          const orbitX = cx + Math.cos(theta) * radius;
          const orbitY = cy + Math.sin(theta) * radius * .53 + (phase - .5) * h * .3;
          const origin = startPoints[i % 4];
          const lift = Math.min(1, phase / .18);
          const x = origin.x + (orbitX - origin.x) * lift;
          const y = origin.y + (orbitY - origin.y) * lift;
          const scattered = phase > .82 ? (phase - .82) * 5 : 0;
          drawCard(x + Math.cos(theta) * w * scattered, y + Math.sin(theta) * h * scattered,
            theta + phase * 5, .48 + (Math.sin(theta) + 1) * .2, i % 4, 1 + (i * 7) % 13);
        }
      }
    }
    if (t >= 1) app.finishVictoryAnimation();
    else raf = win.requestAnimationFrame(tick);
  }

  function tick(timestamp) {
    try { frame(timestamp); } catch { app.finishVictoryAnimation(); }
  }

  function cancel() {
    if (cancelled) return;
    cancelled = true;
    win.cancelAnimationFrame(raf);
    overlay.remove();
    if (root._victoryEffect === effect) root._victoryEffect = null;
  }
  const effect = { cancel };
  root._victoryEffect = effect;
  effect.type = type;
  app.setVictoryAnimationCleanup(cancel);
  resize();
  overlay.querySelector('button').addEventListener('click', () => app.finishVictoryAnimation());
  if (reduced) app.finishVictoryAnimation();
  else {
    queueMicrotask(() => overlay.querySelector('button')?.focus());
    raf = win.requestAnimationFrame(tick);
  }
  return cancel;
}

export function syncVictoryAnimation(root, state, app) {
  if (!state.victoryAnimation) {
    root._victoryEffect?.cancel();
    return;
  }
  if (root._victoryEffect?.type === state.victoryAnimation) return;
  const cancel = playVictoryAnimation(root, state.victoryAnimation, app);
  return cancel;
}
