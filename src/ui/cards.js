/**
 * SVG Card artwork and DOM node generators for Klondike Solitaire.
 * Follows ARCHITECTURE §8 and REQUIREMENTS U03/U07/N02.
 */

import { suitIndex as getSuitIndex, rank as getRank, color as getColor } from '../engine/cards.js';

export const SUIT_NAMES = ['trefl', 'karo', 'kier', 'pik'];
export const SUIT_LABELS = ['trefl', 'karo', 'kier', 'pik'];
export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'];
export const SUIT_COLORS = {
  trefl: '#1a1a1a',
  karo: '#c62828',
  kier: '#c62828',
  pik: '#1a1a1a',
};

export const RANK_LABELS = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

export const RANK_NAMES = {
  1: 'As',
  2: 'Dwójka',
  3: 'Trójka',
  4: 'Czwórka',
  5: 'Piątka',
  6: 'Szóstka',
  7: 'Siódemka',
  8: 'Ósemka',
  9: 'Dziewiątka',
  10: 'Dziesiątka',
  11: 'Walet',
  12: 'Dama',
  13: 'Król',
};

export function getCardDetails(cardId) {
  const suitIdx = getSuitIndex(cardId);
  const r = getRank(cardId);
  const c = getColor(cardId);
  const suit = SUIT_NAMES[suitIdx];
  const suitSymbol = SUIT_SYMBOLS[suitIdx];
  const rankLabel = RANK_LABELS[r];
  const rankName = RANK_NAMES[r];
  const suitName = SUIT_LABELS[suitIdx];
  const fullName = `${rankName} ${suitName}`;

  return {
    cardId,
    suitIndex: suitIdx,
    suit,
    suitSymbol,
    rank: r,
    rankLabel,
    rankName,
    suitName,
    fullName,
    color: c,
    hexColor: SUIT_COLORS[suit],
  };
}

/**
 * Clean SVG path strings for the four suits in a 24x24 viewport.
 */
export const SUIT_PATHS = {
  kier: 'M 12 21 C 12 21 3 14.5 3 8.5 C 3 5 5.5 2.5 9 2.5 C 10.8 2.5 11.8 3.5 12 4 C 12.2 3.5 13.2 2.5 15 2.5 C 18.5 2.5 21 5 21 8.5 C 21 14.5 12 21 12 21 Z',
  karo: 'M 12 2 L 20 12 L 12 22 L 4 12 Z',
  pik: 'M 12 2 C 9.5 6.5 4 10.5 4 14 C 4 16.5 5.8 18 8 18 C 9.4 18 10.6 17.2 11.2 16.2 L 10.5 21 L 13.5 21 L 12.8 16.2 C 13.4 17.2 14.6 18 16 18 C 18.2 18 20 16.5 20 14 C 20 10.5 14.5 6.5 12 2 Z',
  trefl: 'M 12 2 C 10.3 2 9 3.3 9 5 C 9 5.5 9.1 6 9.4 6.4 C 8.2 6.1 7 7.1 7 8.5 C 7 10.2 8.3 11.5 10 11.5 C 10.4 11.5 10.8 11.4 11.2 11.2 L 10.5 18 L 13.5 18 L 12.8 11.2 C 13.2 11.4 13.6 11.5 14 11.5 C 15.7 11.5 17 10.2 17 8.5 C 17 7.1 15.8 6.1 14.6 6.4 C 14.9 6 15 5.5 15 5 C 15 3.3 13.7 2 12 2 Z',
};

/**
 * Returns SVG markup for a suit icon.
 */
export function getSuitSvg(suit, size = 16) {
  const path = SUIT_PATHS[suit] || '';
  const color = SUIT_COLORS[suit] || 'currentColor';
  return `<svg class="suit-icon suit-${suit}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" fill="${color}" /></svg>`;
}

/**
 * Generates an SVG card back with an intricate geometric pattern.
 * Strictly complies with N02: no card ID, rank, or suit in DOM or markup.
 */
export function renderCardBackSvg() {
  return `<svg class="card-svg card-svg-back" viewBox="0 0 100 140" width="100%" height="100%" aria-hidden="true">
  <defs>
    <pattern id="card-back-lattice" width="10" height="10" patternUnits="userSpaceOnUse">
      <path d="M 0 5 L 5 0 L 10 5 L 5 10 Z" fill="none" stroke="#254d7e" stroke-width="0.8" />
      <circle cx="5" cy="5" r="1" fill="#d4af37" />
    </pattern>
  </defs>
  <rect x="1" y="1" width="98" height="138" rx="6" ry="6" fill="#0d2b45" stroke="#ffffff" stroke-width="2"/>
  <rect x="4" y="4" width="92" height="132" rx="4" ry="4" fill="none" stroke="#d4af37" stroke-width="1"/>
  <rect x="7" y="7" width="86" height="126" rx="3" ry="3" fill="url(#card-back-lattice)" stroke="#254d7e" stroke-width="0.5"/>
  <circle cx="50" cy="70" r="16" fill="#0d2b45" stroke="#d4af37" stroke-width="1.5" />
  <circle cx="50" cy="70" r="11" fill="none" stroke="#254d7e" stroke-width="1" />
  <circle cx="50" cy="70" r="4" fill="#d4af37" />
</svg>`;
}

/**
 * Generates center artwork SVG markup for a face-up card.
 */
function renderCenterArtSvg(details) {
  const { rank, suit, hexColor } = details;
  const path = SUIT_PATHS[suit];

  if (rank === 1) {
    // Large center Ace symbol
    return `<g transform="translate(30, 48) scale(1.67)"><path d="${path}" fill="${hexColor}" /></g>`;
  }

  if (rank === 11) {
    // Court Jack
    return `<g transform="translate(25, 42)">
      <rect x="0" y="0" width="50" height="56" rx="4" fill="none" stroke="#d4af37" stroke-width="1.2" />
      <path d="M 12 14 L 38 14 L 25 38 Z" fill="${hexColor}" opacity="0.8" />
      <circle cx="25" cy="22" r="6" fill="#d4af37" />
      <text x="25" y="50" font-family="system-ui, sans-serif" font-size="14" font-weight="900" fill="${hexColor}" text-anchor="middle">J</text>
    </g>`;
  }

  if (rank === 12) {
    // Court Queen
    return `<g transform="translate(25, 42)">
      <rect x="0" y="0" width="50" height="56" rx="4" fill="none" stroke="#d4af37" stroke-width="1.2" />
      <path d="M 10 36 C 10 18 40 18 40 36 Z" fill="${hexColor}" opacity="0.8" />
      <circle cx="25" cy="18" r="8" fill="#d4af37" />
      <text x="25" y="50" font-family="system-ui, sans-serif" font-size="14" font-weight="900" fill="${hexColor}" text-anchor="middle">Q</text>
    </g>`;
  }

  if (rank === 13) {
    // Court King
    return `<g transform="translate(25, 42)">
      <rect x="0" y="0" width="50" height="56" rx="4" fill="none" stroke="#d4af37" stroke-width="1.2" />
      <path d="M 8 36 L 15 16 L 25 28 L 35 16 L 42 36 Z" fill="#d4af37" />
      <circle cx="25" cy="14" r="3" fill="${hexColor}" />
      <text x="25" y="50" font-family="system-ui, sans-serif" font-size="14" font-weight="900" fill="${hexColor}" text-anchor="middle">K</text>
    </g>`;
  }

  // Number cards (2–10): center badge with suit
  return `<g transform="translate(32, 52)">
    <circle cx="18" cy="18" r="16" fill="none" stroke="${hexColor}" stroke-width="0.8" opacity="0.3" />
    <g transform="translate(6, 6) scale(1.0)"><path d="${path}" fill="${hexColor}" /></g>
  </g>`;
}

/**
 * Creates a complete DOM node for a card.
 */
export function createCardElement(cardId, isFaceUp = true) {
  const cardNode = document.createElement('div');

  if (!isFaceUp) {
    cardNode.className = 'card-node card-back';
    cardNode.setAttribute('role', 'img');
    cardNode.setAttribute('aria-label', 'Karta zakryta');
    cardNode.innerHTML = renderCardBackSvg();
    return cardNode;
  }

  const details = getCardDetails(cardId);
  cardNode.className = `card-node card-face-up suit-${details.suit} color-${details.color}`;
  cardNode.dataset.cardId = String(cardId);
  cardNode.dataset.rank = String(details.rank);
  cardNode.dataset.suit = details.suit;
  cardNode.setAttribute('role', 'img');
  cardNode.setAttribute('aria-label', details.fullName);

  // Compact horizontal corner index inside exposed band (ARCHITECTURE §8)
  const cornerTopLeft = `
    <div class="card-corner card-corner-tl" aria-hidden="true">
      <span class="card-rank">${details.rankLabel}</span>
      <span class="card-mini-suit">${getSuitSvg(details.suit, 13)}</span>
    </div>
  `;

  const cornerBottomRight = `
    <div class="card-corner card-corner-br" aria-hidden="true">
      <span class="card-rank">${details.rankLabel}</span>
      <span class="card-mini-suit">${getSuitSvg(details.suit, 13)}</span>
    </div>
  `;

  const faceSvg = `
    <svg class="card-svg card-svg-face" viewBox="0 0 100 140" width="100%" height="100%" aria-hidden="true">
      <rect x="0.5" y="0.5" width="99" height="139" rx="6" ry="6" fill="#fffff8" stroke="#222222" stroke-width="1.2"/>
      ${renderCenterArtSvg(details)}
    </svg>
  `;

  cardNode.innerHTML = `${cornerTopLeft}${cornerBottomRight}${faceSvg}`;
  return cardNode;
}

/**
 * Creates empty pile placeholder nodes with appropriate Polish aria labels.
 */
export function createEmptySlotElement(pileType, index = null, options = {}) {
  const slot = document.createElement('div');
  slot.className = `pile-slot pile-slot-${pileType}`;

  if (pileType === 'stock') {
    slot.setAttribute('aria-label', options.canRecycle ? 'Przetasuj skrawek' : 'Pusty stos');
    if (options.canRecycle) {
      slot.classList.add('can-recycle');
      slot.innerHTML = `
        <svg class="slot-icon recycle-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
          <path d="M 12 4 V 1 L 8 5 L 12 9 V 6 C 15.31 6 18 8.69 18 12 C 18 13.01 17.75 13.97 17.3 14.8 L 18.76 16.26 C 19.54 15.03 20 13.57 20 12 C 20 7.58 16.42 4 12 4 Z M 6 12 C 6 10.99 6.25 10.03 6.7 9.2 L 5.24 7.74 C 4.46 8.97 4 10.43 4 12 C 4 16.42 7.58 20 12 20 V 23 L 16 19 L 12 15 V 18 C 8.69 18 6 15.31 6 12 Z" fill="#9ec5a8"/>
        </svg>
      `;
    }
  } else if (pileType === 'waste') {
    slot.setAttribute('aria-label', 'Pusty skrawek');
  } else if (pileType === 'foundation') {
    const suit = SUIT_NAMES[index] || 'trefl';
    slot.setAttribute('aria-label', `Baza ${suit} (pusta)`);
    slot.dataset.suit = suit;
    slot.innerHTML = `
      <div class="foundation-watermark" aria-hidden="true">
        ${getSuitSvg(suit, 24)}
      </div>
    `;
  } else if (pileType === 'tableau') {
    const colIndex = (index ?? 0) + 1;
    slot.setAttribute('aria-label', `Kolumna ${colIndex} (pusta)`);
    slot.dataset.column = String(index ?? 0);
    slot.innerHTML = `<span class="tableau-watermark" aria-hidden="true">K</span>`;
  }

  return slot;
}
