import { getCardDetails, SUIT_NAMES } from './cards.js';

const POLISH_NUMERAL_GENITIVE = {
  2: 'dwóch ruchów',
  3: 'trzech ruchów',
  4: 'czterech ruchów',
  5: 'pięciu ruchów',
  6: 'sześciu ruchów',
  7: 'siedmiu ruchów',
  8: 'ośmiu ruchów',
  9: 'dziewięciu ruchów',
  10: 'dziesięciu ruchów',
  11: 'jedenastu ruchów',
  12: 'dwunastu ruchów',
};

function formatGoalSuffix(goal, planLength) {
  const goalPhrase =
    goal === 'REVEAL' ? 'pozwolą odsłonić kartę' :
    goal === 'FOUNDATION_ADVANCE' ? 'pozwolą przenieść kartę do bazy' :
    'pozwolą osiągnąć postęp';

  if (planLength === 1) {
    if (goal === 'REVEAL') return 'Ten ruch pozwala odsłonić kartę.';
    if (goal === 'FOUNDATION_ADVANCE') return 'Ten ruch przenosi kartę do bazy.';
    return 'Ten ruch pozwala osiągnąć postęp.';
  }

  const numGen = POLISH_NUMERAL_GENITIVE[planLength] || `${planLength} ruchów`;
  return `To pierwszy z ${numGen}, które ${goalPhrase}.`;
}

function formatInitialMove(state, move) {
  if (move.type === 'draw') {
    return 'Dobierz kartę ze stosu.';
  }
  if (move.type === 'recycle') {
    return 'Przetasuj skrawek.';
  }

  const from = move.from;
  const to = move.to;

  let cardName = 'kartę';
  if (from.pile === 'tableau') {
    const col = state.tableau[from.index];
    const cardId = col.cards[from.cardIndex];
    if (cardId !== undefined) cardName = getCardDetails(cardId).fullName;
  } else if (from.pile === 'waste') {
    const cardId = state.waste[state.waste.length - 1];
    if (cardId !== undefined) cardName = getCardDetails(cardId).fullName;
  } else if (from.pile === 'foundation') {
    const pile = state.foundations[from.index];
    const cardId = pile[pile.length - 1];
    if (cardId !== undefined) cardName = getCardDetails(cardId).fullName;
  }

  let fromDesc = '';
  if (from.pile === 'tableau') {
    fromDesc = `z kolumny ${from.index + 1}`;
  } else if (from.pile === 'waste') {
    fromDesc = 'ze skrawka';
  } else if (from.pile === 'foundation') {
    fromDesc = `z bazy ${SUIT_NAMES[from.index]}`;
  }

  let toDesc = '';
  if (to.pile === 'tableau') {
    const targetCol = state.tableau[to.index];
    if (targetCol.cards.length > 0) {
      const targetCardId = targetCol.cards[targetCol.cards.length - 1];
      toDesc = `na ${getCardDetails(targetCardId).fullName}`;
    } else {
      toDesc = `na pustą kolumnę ${to.index + 1}`;
    }
  } else if (to.pile === 'foundation') {
    toDesc = `do bazy ${SUIT_NAMES[to.index]}`;
  }

  return `Przenieś ${cardName} ${fromDesc} ${toDesc}.`;
}

/**
 * Format human-readable Polish explanation and announcement for SmartHint result.
 */
export function formatSmartHintMessage(state, hint) {
  if (!hint) return '';
  if (hint.status === 'WON') return '';

  if (hint.status === 'EXPLORATION') {
    if (hint.plan.length === 1 && hint.plan[0].type === 'draw') {
      return 'Dobierz kartę, aby poznać kolejną możliwość.';
    }
    const firstDesc = formatInitialMove(state, hint.plan[0]);
    const numGen = POLISH_NUMERAL_GENITIVE[hint.plan.length] || `${hint.plan.length} ruchów`;
    return `${firstDesc} To pierwszy z ${numGen}, które pozwolą poznać nową możliwość.`;
  }

  if (hint.status === 'FOUND' && hint.plan.length > 0) {
    const firstMoveDesc = formatInitialMove(state, hint.plan[0]);
    const goalSuffix = formatGoalSuffix(hint.goal, hint.plan.length);
    return `${firstMoveDesc} ${goalSuffix}`;
  }

  if (hint.status === 'INCONCLUSIVE') {
    return 'Nie udało się znaleźć ruchu prowadzącego do postępu.';
  }

  return '';
}
