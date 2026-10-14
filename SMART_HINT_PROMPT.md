# Prompt: SmartHint do pasjansa Klondike

Zaimplementuj lub popraw inteligentną podpowiedź (SmartHint) w istniejącej
aplikacji Klondike. Pokaż pierwszy ruch krótkiego planu, który prowadzi do
rzeczywistego postępu. Priorytetem są poprawność i brak podglądania ukrytych
kart; szybkość można poprawić później.

Pracuj na dostarczonym kodzie i zachowaj jego strukturę. Jeśli czat nie widzi
repozytorium, poproś najpierw tylko o te fragmenty, których brakuje:

1. Moduł SmartHint oraz sygnatury i kształt stanu z silnika gry.
2. Implementacje widoczności/kart znanych i klucza stanu używanego w wyszukiwaniu.
3. Fragment kontrolera, który uruchamia hint, oraz formatter komunikatu UI.
4. Powiązane testy SmartHint i fixture odtwarzające przypadki brzegowe.

Poproś o treść fragmentów, nie o ścieżkę do repozytorium. Nie żądaj całego UI,
stylów, `package.json` ani pełnego zestawu testów, chyba że konkretna zmiana tego
wymaga. Jeśli zakres kodu jest duży, poproś o pliki etapami. Nie zgaduj brakującego
API ani nie pisz fikcyjnej integracji. Uzupełnij istniejący kod zamiast budować
drugi system. Nie dodawaj zależności runtime ani nie zmieniaj zasad gry, zapisu
czy shuffle.

## Kontrakt silnika

- JavaScript ES modules, bez TypeScriptu. Planer jest czystą logiką: bez DOM,
  historii sesji, zapisu i wykonywania ruchów.
- Używaj istniejących `getLegalMoves(state)`, niemutującego
  `applyMove(state, command)`, `isWon(state)` i `visibleCards(state)`.
  Silnik jest jedynym autorytetem legalności. Nie duplikuj zasad.
- `CardId` to liczba 0–51 (`suitIndex * 13 + rank - 1`). Tablice są ułożone
  od dołu do góry; wierzch jest na końcu. Tableau ma zakryty prefix przed
  `faceUpStart`. `drawCount` wynosi 1 lub 3.
- Komendy to `{type:'draw'}`, `{type:'recycle'}` lub
  `{type:'move', from, to}`. Tableau `cardIndex` wskazuje początek całego
  przenoszonego odkrytego ciągu. Odsłonięcie karty tableau jest częścią ruchu.
- Wiedza `knownCards` należy do sesji. Podpowiedź jej nie aktualizuje; pamięć
  zmienia się dopiero po prawdziwym ruchu. Undo nie zapomina kart.

## Wyszukiwanie i wiedza

Zachowaj generator API:

```js
searchSmartHint(state, knownCards = [], {
  maxStates = 10000, maxDepth = 32, signal, previousHint,
} = {})
```

Użyj ograniczonego Best-First Search legalnych komend. Można rozwijać ruchy
przygotowawcze, także przejściowo niekorzystne (np. cofnięcie karty z bazy).
Nie kończ gałęzi po samym awansie baz, jeśli może prowadzić dalej do celu.
Odrzucaj powtórzony stan osiągnięty nie droższą ścieżką; użyj istniejącego
`progressStateKey`/`progressKeyFor`, jeśli pasuje. Remisy rozstrzygaj stabilnie.

`maxStates` ogranicza zachowane różne stany i rzeczywiste rozwinięcia; korzeń
też liczy się do limitu. `maxDepth` ogranicza wszystkie komendy, w tym draw
i recycle. Limit, przerwanie lub anulowanie nie mogą zostać przedstawione jako
pełne przeszukanie. Stały limit stanów powinien dawać deterministyczny wynik.

Stan zawiera zakryte ID, ale ich wartości nie są informacją dla planera.
Ukryte rangi, symbole i kolory nie mogą wpływać na ocenę, wybór gałęzi ani remisy.
Pamięć `knownCards` nie uprawnia do przewidywania ruchów zakrytej karty.

Zakończ gałąź na pierwszej granicy nowej informacji:

- każde odsłonięcie tableau, także wcześniej zapamiętanej karty;
- dobranie nieznanej karty ze stock;
- zdjęcie waste, które odsłania nieznaną kartę pod wachlarzem.

Ruch na granicy może być końcem planu; nie analizuj potem ujawnionej wartości.
Na tej granicy maskuj nową kartę także przy obliczaniu legalnych możliwości.
Nie wolno traktować zakrytej, niepustej kolumny jako pustej. Odsłonięcie tableau
liczy się jako H, nigdy jako I.

## Cele i ocena

Cel końcowy musi być jednym z poniższych:

- `REVEAL`: odsłonięcie co najmniej jednej zakrytej karty tableau;
- `FOUNDATION_ADVANCE`: dodatni przyrost liczby kart w bazach względem
  korzenia analizy;
- `INFORMATION`: zdobycie nowej informacji na granicy opisanej wyżej.

Waste→tableau, znany draw/recycle, ruchy między kolumnami i powrót z bazy mogą
być przygotowaniem, ale samodzielnie nie tworzą celu. Ostatnia komenda planu
musi wprowadzać H, F lub I względem poprzedniego stanu. Nie dopisuj ruchów po
osiągnięciu celu. Awans baz jest samodzielnym celem: nie wymagaj kolejnego celu
ani dowodu, że da się kontynuować.

Składniki licz względem korzenia S0:

| Symbol | Znaczenie |
| --- | --- |
| H | Liczba odsłoniętych zakrytych kart tableau. |
| F | Zmiana liczby kart w bazach (może być ujemna). Powrót tej samej karty do bazy nie daje zysku. |
| I | 1 za nieznany draw/nową kartę waste, w przeciwnym razie 0. Tableau nie daje I. |
| W | Liczba różnych kart ze stock/waste S0 przeniesionych do tableau/baz; premia wyłącznie za przygotowanie. |
| M / B | Nowe / utracone użyteczne możliwości: legalny ruch bezpośrednio odsłaniający tableau lub zwiększający bazy. Zrealizowana korzyść nie jest stratą B. |
| L | Liczba komend, wliczając draw i recycle. |

Użyteczną możliwość identyfikuj kartą rozpoczynającą przenoszony ciąg i typem
korzyści; równoważne miejsca docelowe nie mnożą wyniku. Pusta kolumna lub
przesuwanie króla między pustymi kolumnami samo nie daje punktów.

```text
U = 120H + 40F_goal + 20I + 10M - E - 50B
priorytet kolejki = U + 65W - 3,5N
```

`N` to liczba draw/recycle. `E` wynosi 4 za transfer lub nieznane dobranie oraz
0,5 za znane dobranie/recycle. Dla REVEAL `F_goal` zachowuje ujemne F, a dodatnie
F liczy najwyżej jako 1 i tylko wtedy, gdy końcowy ruch jednocześnie przenosi
kartę do bazy. Dla pozostałych celów `F_goal = F`. W nie wchodzi do U. Publikuj
tylko plany z U > 0.

Wybór celu: REVEAL przed FOUNDATION_ADVANCE przed INFORMATION. W ramach celu:
REVEAL preferuje większe H, krótszy plan, lepszą estymację po odsłonięciu,
mniejsze B, większe U; FOUNDATION_ADVANCE preferuje większe F, mniejsze B,
krótszy plan i większe U; INFORMATION preferuje krótszy plan, lepszą estymację,
mniejsze B i większe U. Na końcu użyj stabilnej kolejności.

Estymacja po odsłonięciu jest pomocnicza, tylko na granicy informacji. Nie
odczytuj położeń nieznanych kart: oszacuj jedną kartę z puli ID 0–51 poza kartami
znanymi i widocznymi w korzeniu. Korzyść: 2 za ruch do bazy, w przeciwnym razie
1,5 za króla pasującego do pustej kolumny, w przeciwnym razie 1 za dopasowanie
rangi i przeciwnego koloru do znanego wierzchu tableau, inaczej 0. Policz średnią
po puli; pusta pula daje 0. Pomiń właśnie odsłonięty wierzch tableau, również
zapamiętany. Estymacja nie jest gwarancją ani składnikiem U.

## Wyniki i anulowanie

Wynik zawiera `{status, plan, goal, score, visitedStates, truncated}`.
Rekomendacja zawiera też `components: {H,F,I,W,M,B,L}`, `verification` i
diagnostykę. Zachowaj istniejące `analyzeHintPlan` do legalnego replayu i oceny
planu.

- `FOUND`: dodatni plan celu REVEAL lub FOUNDATION_ADVANCE.
- `EXPLORATION`: dodatni plan celu INFORMATION; nie obiecuje dalszego postępu.
- `INCONCLUSIVE`: brak wiarygodnej dodatniej rekomendacji; pusty plan,
  `goal: null`, `score: null`.
- `NO_STRATEGIC_PROGRESS`: wyłącznie po pełnym przeszukaniu bez celów H/F/I;
  `truncated: false`, pusty plan, `recommendedMove: null`.
- `WON`: plansza już wygrana; sprawdzaj przed wyszukiwaniem, bez sugestii.

Przy każdym yield zachowuj najlepszą dotąd legalną rekomendację. `signal`
pozwala przerwać generator; anulowanie zawsze ustawia `truncated: true` i
zwraca zachowany plan, jeśli istnieje. Nie raportuj wyczerpania po limicie,
przerwaniu ani anulowaniu. `verification` potwierdza osiągnięty cel i dodatnie
U; `horizon` wynosi 0, więc nie obiecuje przyszłego rozwiązania.

Jeśli istnieje `previousHint` i gracz wykonał pierwszy ruch jego planu, sprawdź
pozostałe komendy replayem. Kontynuuj tylko, gdy są legalne, mieszczą się w
`maxDepth`, nie przekraczają granicy informacji i nadal osiągają dodatni cel.
W przeciwnym razie wykonaj nowe wyszukiwanie.

## Integracja i sprawdzenie

Kontroler uruchamia analizę na żądanie, w krótkich porcjach, poza planerem.
Domyślne limity aplikacji: 10000 stanów, 32 komendy, około 4 ms pracy na porcję,
100 ms łącznej aktywnej pracy. Wolniejsze wyszukiwanie jest akceptowalne, jeśli
interfejs pozostaje responsywny i wynik uczciwie sygnalizuje cięcie.
Unieważnij stare wyniki po ruchu, Undo/Redo, nowej grze, restarcie, restore lub
zmianie wiedzy. Anuluj przy pauzie, dialogu, ukryciu strony i zamknięciu widoku.
Stary wynik nie może nadpisać nowszego.

UI pokazuje po polsku opis pierwszego legalnego ruchu, cel i długość planu,
podświetla jego źródło/cel i ogłasza wynik czytnikom ekranu. Nie ujawniaj
zakrytych kart; nie wykonuj planu automatycznie. Wykonanie podpowiedzi pozostaje
zwykłym, walidowanym ruchem gracza. Zachowaj klawiaturę, fokus i obsługę ekranu
320 px. F04 (`searchProgress`) jest oddzielnym dowodem osiągalności: SmartHint
`NO_STRATEGIC_PROGRESS` nigdy go nie zastępuje i żaden status nie oznacza,
że rozdanie jest niewygrywalne.

Zachowaj regresje dla: bezpośredniego i wieloetapowego celu, przygotowania przez
stock/waste i powrotu z bazy, Draw 1/3, cykli, terminalnego awansu baz, ukrytych
permutacji, granic informacji, limitów/anulowania, kontynuacji, Undo/Redo,
starego wyniku, WON oraz oddzielnego F04. Każdy plan musi przechodzić replay
przez silnik; sprawdź niemutowanie stanu. Użyj testów i skryptów już obecnych
w projekcie. Raportuj faktycznie uruchomione testy i ograniczenia. Benchmark
może być odroczony; szybkość nie jest kryterium tej implementacji.
