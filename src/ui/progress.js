export function noProgressMessage(noLegalMoves, session) {
  const reason = noLegalMoves ? 'Brak dostępnych ruchów.' : 'Brak ruchów prowadzących do dalszego postępu.';
  const suggestion = session?.cursor > 0
    ? 'Możesz cofnąć wcześniejsze ruchy i spróbować innej drogi lub rozpocząć nową grę.'
    : 'Możesz rozpocząć nową grę.';
  return `${reason} ${suggestion}`;
}
