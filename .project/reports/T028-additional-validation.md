# T028 — dodatkowa weryfikacja, 2026-10-11

Zlecenie koordynatora: więcej testów i sprawdzenie na symulatorze.
Zakres: weryfikacja, bez naprawy kodu produktu. Start: `9ff0331`, master.
Podczas pracy zewnętrznie zmieniono CSS/renderer i zapisano `b674961`.
Nie dołączano tych zmian. Wyniki przeglądarkowe dotyczą środowiska roboczego
w trakcie tych zmian, nie izolowanego checkoutu konkretnego commitu.

## Wyniki faktycznie uruchomionych poleceń

| Polecenie | Wynik |
| --- | --- |
| `npm test` (przed dodaniem nowych reprodukcji) | 197 PASS, 15 plików |
| `npm run test:simulation -- --profile=ci` | 13 PASS, 169,64 s |
| `npm run build` | PASS |
| `npm run test:e2e -- tests/e2e/smart-hints.spec.js tests/e2e/progress.spec.js` | 17 PASS, Chromium, 9,8 s |
| `npm test -- tests/unit/smart-hints-regression.test.js` | 1 PASS, 3 FAIL, 18,90 s |

Profil CI obejmuje 2002 rozdania: seedy 0–999 i 4294967295, oba tryby,
maksymalnie 300 kroków na rozdanie. Sprawdza reguły, niemutowanie, odrzucenia,
historię i restore; nie jest pomiarem jakości SmartHint. Reporter nie wyświetlił
sumy wykonanych kroków, więc nie podajemy jej jako zmierzonej.

Dodatkowa symulacja SmartHint: 40 rozdań (0–19 w obu trybach), do 20 sugestii,
maxStates=64, maxDepth=8. PASS: wejścia niezmienione, wszystkie komendy całych
planów legalne i zgodne z niezmiennikami, plan kończy się na pierwszej granicy
nowej informacji, brak NO_PROGRESS. Ten mały budżet nie weryfikuje jakości
domyślnego wyszukiwania.

Oddzielny Node smoke pomiar: seedy 0 i 42, oba tryby, 20 pierwszych ruchów
podpowiedzi na rozdanie, domyślny planer przerywany między wywołaniami next()
po 100 ms. 80/80 wykonanych ruchów legalnych, 4 odcięcia, mediana 2,56 ms,
p95 100,13 ms, najdłuższe pojedyncze next() 9,85 ms. Bez schedulera przeglądarki;
nie jest pomiarem urządzenia mobilnego ani pełnym benchmarkiem porównawczym.

## Potwierdzone problemy

1. **Ukryte wartości wpływają na ocenę.** Przy niezmienionych kartach widocznych
   odwrócenie nieznanego stock zmienia score w 9/200 rozdań. Draw 1: seedy
   51,55,67,95; Draw 3: 12,55,64,67,73. Przykład seed=51, Draw 1: 16 → 26.
   W tych reprodukcjach plan pozostaje `[draw]`; nie twierdzimy, że pierwszy
   ruch uległ zmianie. Przyczyna: evaluateSequence maskuje tableau na granicy,
   ale computePossibilities nadal otrzymuje nowo dobrany nieznany waste.
2. **Nieoznaczone odcięcie czasowe.** Kontroler publikuje latestValue bez
   wymuszenia truncated=true po przerwaniu generatora przez 100 ms. Test z
   seed=42/Draw 1 i kontrolowanym zegarem (+101 na odczyt) otrzymał false.
   Nie wykryto ogłoszenia NO_PROGRESS; problem dotyczy rzetelności metadanych.

Dotychczasowe stwierdzenie raportu głównego „No further code changes needed”
nie uwzględnia tych reprodukcji. T028 nie należy akceptować bez ich rozstrzygnięcia.

## Reprodukcja problemu 1 bez dodatkowego pliku testowego

Uruchomić z katalogu repo jako moduł Node (`node --input-type=module`, kod na stdin):

```js
import assert from 'node:assert/strict';
import { createGame } from './src/engine/cards.js';
import { visibleCards } from './src/engine/knowledge.js';
import { searchSmartHint } from './src/engine/smart-hints.js';
const state = createGame({ seed: 51, drawCount: 1 });
function run(board) {
  const gen = searchSmartHint(board, visibleCards(state), { maxDepth: 1, maxStates: 100 });
  let step;
  do { step = gen.next(); } while (!step.done);
  return step.value;
}
assert.deepEqual(run(state), run({ ...state, stock: [...state.stock].reverse() }));
```

## Ograniczenia i wznowienie

Nowy plik `tests/unit/smart-hints-regression.test.js` z czterema testami został
uruchomiony, ale następnie zniknął podczas równoległej pracy zewnętrznej.
Nie przywracano go nad cudzą zmianą; nie znajduje się w tym commicie.
Przy wznowieniu odtworzyć reprodukcje z powyższych parametrów, naprawić wspólną
przyczynę i uruchomić je ponownie. Nie wykonywano napraw, pełnego benchmarku
100 rozdań/tryb ani fizycznych testów iPhone/Android/Safari; nie wykonano push.


## Follow-up resolution (2026-10-11)

Both issues repaired in the subsequent coordinator-assigned T028 revision;
see the regression repair delivery in T028.md. Correction: the seed-42 clock
fixture completed immediately and was not evidence of an unfinished cutoff.
The replacement seed-0 test first verifies generator.next().done=false, then
reproduces the missing flag on the old controller and passes with the repair.
Seed 42 is retained as the completed-search control. This supersedes the
unresolved status above, not the historical execution records.
