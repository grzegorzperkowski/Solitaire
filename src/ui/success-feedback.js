/** Decorative effects for fresh commands only; history navigation is not a success. */
export function successFeedback(previous, current) {
  if (!previous || previous.attemptId !== current.attemptId
    || current.cursor !== previous.cursor + 1
    || current.snapshots[previous.cursor] !== previous.state) return [];
  const command = current.commands[current.cursor - 1];
  if (command === previous.commands[current.cursor - 1] || command?.type !== 'move') return [];

  const effects = [];
  if (command.from.pile === 'tableau') {
    const index = command.from.index;
    const before = previous.state.tableau[index];
    const after = current.state.tableau[index];
    if (after.cards.length === 0) {
      effects.push({ target: `#column-${index} .pile-slot`, kind: 'empty', level: 1 });
    } else if (after.faceUpStart < before.faceUpStart) {
      effects.push({ target: `#column-${index} .card-node:last-child`, kind: 'reveal', level: 1 });
    }
  }
  if (command.to.pile === 'foundation') {
    let level = 1;
    for (let i = current.cursor - 2; i >= 0 && level < 4; i--) {
      const prior = current.commands[i];
      if (prior.type !== 'move' || prior.to.pile !== 'foundation') break;
      level++;
    }
    const ace = current.state.foundations[command.to.index].length === 1;
    if (ace || level > 1) {
      effects.push({ target: `#foundation-${command.to.index} .card-node`, kind: ace ? 'ace' : 'streak', level });
    }
  }
  return effects;
}
