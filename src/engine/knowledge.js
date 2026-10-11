// Match the board renderer: all face-up tableau, foundation cards and waste fan.
export function visibleCards(state) {
  return [
    ...state.tableau.flatMap((column) => column.cards.slice(column.faceUpStart)),
    ...state.foundations.flat(),
    ...state.waste.slice(-state.drawCount),
  ];
}

export function rememberVisible(state, knownCards = []) {
  const known = new Set(knownCards);
  const visible = visibleCards(state);
  if (visible.every((id) => known.has(id))) return knownCards;
  return Object.freeze([...new Set([...knownCards, ...visible])].sort((a, b) => a - b));
}
