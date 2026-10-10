/**
 * SVG Card artwork and DOM node generators for Klondike Solitaire.
 * Follows ARCHITECTURE §8 and REQUIREMENTS U03/U07/N02.
 */

import { suitIndex as getSuitIndex, rank as getRank, color as getColor } from '../engine/cards.js';

import cardAssets from '../assets/cards.svg';

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
  return `<svg class="card-svg card-svg-back" viewBox="0 0 100 140" width="100%" height="100%" aria-hidden="true"><use href="${cardAssets}#card-back-pattern" /></svg>`;
}

const PIP_POSITIONS = {
  2: [[50, 38], [50, 102]],
  3: [[50, 32], [50, 70], [50, 108]],
  4: [[35, 38], [65, 38], [35, 102], [65, 102]],
  5: [[35, 38], [65, 38], [50, 70], [35, 102], [65, 102]],
  6: [[34, 30], [66, 30], [34, 70], [66, 70], [34, 110], [66, 110]],
  7: [[34, 26], [66, 26], [34, 70], [66, 70], [34, 114], [66, 114], [50, 48]],
  8: [[34, 26], [66, 26], [34, 70], [66, 70], [34, 114], [66, 114], [50, 48], [50, 92]],
  9: [[31, 25], [69, 25], [31, 48], [69, 48], [31, 92], [69, 92], [31, 115], [69, 115], [50, 70]],
  10: [[31, 24], [69, 24], [31, 47], [69, 47], [31, 70], [69, 70], [31, 93], [69, 93], [31, 116], [69, 116]],
};

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

  if (rank >= 11) {
    const courtRank = ['jack', 'queen', 'king'][rank - 11];
    return `<svg class="court-art" x="24" y="42" width="52" height="84" viewBox="0 0 100 140" aria-hidden="true"><use href="${cardAssets}#court-${courtRank}-${suit}" /></svg>`;
  }

  return PIP_POSITIONS[rank].map(([x, y]) => `<g class="card-pip" transform="translate(${x} ${y}) scale(.68) translate(-12 -12)"><path d="${path}" fill="${hexColor}" /></g>`).join('');
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

  const cornerBottomRight = details.rank >= 11 ? '' : `
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
