/**
 * Board layout and responsive geometry calculations for Klondike Solitaire.
 * Follows ARCHITECTURE §8 and REQUIREMENTS U01–U04/U09.
 */

export const MIN_CARD_WIDTH = 38;
export const MAX_CARD_WIDTH = 104;
export const CARD_ASPECT_RATIO = 1.4; // 5:7 ratio (height = 1.4 * width)
export const MIN_FACE_UP_OVERLAP = 32;
export const MIN_FACE_DOWN_OVERLAP = 8;
export const PREFERRED_FACE_DOWN_OVERLAP = 12;
export const MIN_CORNER_RANK_FONT_SIZE = 14;

/**
 * Computes inter-column gap in pixels based on available container width.
 * ARCHITECTURE §8: g=3px for <=360px, 4px for >360px, up to 10px on desktop.
 */
export function getGap(width) {
  if (width <= 360) return 3;
  if (width <= 768) return 4;
  return Math.min(10, Math.max(4, Math.floor((width - 768) / 100) + 4));
}

/**
 * Computes side padding in pixels based on available container width.
 */
export function getSidePadding(width) {
  if (width <= 430) return 8;
  if (width <= 768) return 12;
  return 16;
}

/**
 * Computes complete board dimensions for a given container width and height.
 */
export function calculateBoardDimensions(containerWidth, containerHeight = null) {
  const safeWidth = Math.max(300, containerWidth);
  const gap = getGap(safeWidth);
  const padding = getSidePadding(safeWidth);
  const usableWidth = safeWidth - 2 * padding;

  // 7 columns with 6 gaps: cardWidth = min(104, (W - 6g) / 7)
  const computedCardWidth = (usableWidth - 6 * gap) / 7;
  const cardWidth = Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, computedCardWidth));
  const cardHeight = Math.round(cardWidth * CARD_ASPECT_RATIO * 100) / 100;
  const boardWidth = Math.round((7 * cardWidth + 6 * gap) * 100) / 100;

  // Preferred face-up overlap is max(24, 0.28 * cardHeight)
  const faceUpOverlap = Math.max(MIN_FACE_UP_OVERLAP, Math.round(cardHeight * 0.28));
  const faceDownOverlap = PREFERRED_FACE_DOWN_OVERLAP;

  // Waste fan offset in Draw 3 mode (fits inside slots 1-2 without spilling into slot 3)
  const maxFanWidth = cardWidth + gap;
  const fanOffset = Math.min(22, Math.max(12, Math.floor(maxFanWidth / 2.6)));

  return {
    containerWidth: safeWidth,
    containerHeight,
    usableWidth,
    padding,
    gap,
    cardWidth,
    cardHeight,
    boardWidth,
    faceUpOverlap,
    faceDownOverlap,
    fanOffset,
  };
}

/**
 * Computes the pixel height required by a tableau column with d hidden and u visible cards.
 * ARCHITECTURE §8: height = d * hiddenOverlap + max(0, u - 1) * faceUpOverlap + cardHeight.
 */
export function calculateColumnHeight(hiddenCount, faceUpCount, dimensions) {
  const { cardHeight, faceUpOverlap, faceDownOverlap } = dimensions;
  if (hiddenCount === 0 && faceUpCount === 0) {
    return cardHeight;
  }
  const hiddenSpan = hiddenCount * faceDownOverlap;
  const faceUpSpan = Math.max(0, faceUpCount - 1) * faceUpOverlap;
  return hiddenSpan + faceUpSpan + cardHeight;
}

/**
 * Applies layout custom properties to a DOM element.
 */
export function applyLayoutVariables(element, dimensions) {
  if (!element || !element.style) return;
  element.style.setProperty('--card-width', `${dimensions.cardWidth}px`);
  element.style.setProperty('--card-height', `${dimensions.cardHeight}px`);
  element.style.setProperty('--board-gap', `${dimensions.gap}px`);
  element.style.setProperty('--board-padding', `${dimensions.padding}px`);
  element.style.setProperty('--board-width', `${dimensions.boardWidth}px`);
  element.style.setProperty('--face-up-overlap', `${dimensions.faceUpOverlap}px`);
  element.style.setProperty('--face-down-overlap', `${dimensions.faceDownOverlap}px`);
  element.style.setProperty('--waste-fan-offset', `${dimensions.fanOffset}px`);
}

/**
 * Attaches a ResizeObserver (with window resize fallback) to watch container size.
 */
export function setupResponsiveLayout(container, onUpdate) {
  if (typeof window === 'undefined') return () => {};

  let lastWidth = -1;
  const handleResize = () => {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    if (Math.abs(width - lastWidth) < 0.5) return;
    lastWidth = width;
    const dims = calculateBoardDimensions(width, height);
    applyLayoutVariables(container, dims);
    if (typeof onUpdate === 'function') {
      onUpdate(dims);
    }
  };

  handleResize();

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    return () => observer.disconnect();
  }

  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}
