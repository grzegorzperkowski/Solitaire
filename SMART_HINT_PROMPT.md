# Prompt dla AI: implementacja SmartHint w pasjansie Klondike

Przygotowano 2026-10-14 na podstawie repozytorium przy `c583fc7`.
Poniższy tekst można przekazać agentowi implementującemu wraz z dostępem do
repozytorium. Samo zapisanie tego pliku nie wznawia T028 ani nie oznacza
akceptacji obecnej implementacji. Prompt opisuje uzgodniony kontrakt; nie jest
nową specyfikacją zasad gry.

---

## Zadanie i sposób pracy

Zaimplementuj SmartHint zgodnie z poniższym kontraktem w repozytorium
`C:\Sources\MyProjets\Solitaire`, w ramach wyraźnie przypisanego przez
koordynatora zadania/wznowienia T028. Przycisk „Podpowiedź” ma pokazywać pierwszy
ruch sensownej sekwencji oraz wyjaśnienie jej celu. Sam legalny ruch nie
wystarcza: pomoc ma prowadzić do odsłonięcia karty, rzeczywistego zwiększenia
baz albo uzyskania nowej informacji.

**Najpierw poprawność i czytelność, optymalizacja później.** Nie wymagamy
szybkiego algorytmu, udowodnionej przewagi czasowej ani optymalnego rozwiązania.
Wolniejsza wersja nadal musi oddawać sterowanie, respektować limity i zwracać
uczciwy wynik częściowy. Zachowaj obecne domyślne budżety; większe limity mogą
służyć do diagnostyki przez istniejące opcje. Pomiar kosztu opisuje ograniczenia,
a nie nakazuje optymalizacji w tym zadaniu.

SmartHint już istnieje. Przeczytaj jego kod i wszystkich wywołujących, a potem
uzupełnij lub popraw potrzebne fragmenty. Nie zakładaj, że trzeba budować nowy
system. Zachowaj vanilla JavaScript ES modules, istniejący silnik i zero nowych
zależności runtime. Planer pozostaje w `src/engine/smart-hints.js`; zegar i
scheduler należą do kontrolera. Zakres nie obejmuje backendu, LLM w aplikacji,
autogry, pełnego solvera, zmiany zasad, shuffle, save schema ani wyglądu planszy.

Przed edycją:

1. Przeczytaj [AGENTS.md](AGENTS.md), [.project/STATUS.md](.project/STATUS.md),
   [.project/HANDOFF.md](.project/HANDOFF.md), [T028](.project/tasks/T028.md) i
   [specyfikację T028](.project/tasks/T028-spec.md).
2. Sprawdź `git status --short`, `git branch --show-current` i
   `git log -5 --oneline`. Pracuj sekwencyjnie na bieżącej gałęzi, bez agentów
   równoległych, nowych gałęzi i worktree. Zachowaj obce zmiany; nie edytuj ani
   nie stage'uj nieśledzonego `solitaire-stan-2284836135-draw1-114.json` z katalogu
   głównego. Do testów jest wersja w `tests/fixtures`.
3. Przeczytaj [REQUIREMENTS.md](REQUIREMENTS.md) R01–R11 i F04,
   [ARCHITECTURE.md](ARCHITECTURE.md) §3, §5–§6 oraz
   [TEST_PLAN.md](TEST_PLAN.md) T20 i sekcje T028.
4. Dla obecnej rewizji przeczytaj
   [raport integracji](.project/reports/T028-integration.md). Starsze raporty
   opisują historyczne wersje. Aktualna integracja **nie wymaga drugiego celu
   po osiągniętym awansie baz** i **nie przyznaje I za odsłonięcie tableau**.
   Zachowaj te zasady mimo starszych opisów dowodzenia kontynuacji.

Dokumenty projektu są pamięcią ustaleń. Jeśli podczas przyszłej pracy pojawi
się sprzeczność zmieniająca zachowanie produktu, przedstaw ją koordynatorowi
przed zmianą kontraktu. Odnotuj przypisanie i IN_PROGRESS zgodnie z AGENTS.md;
obecny stan REVIEW nie jest samodzielnym poleceniem wznowienia.

## Mapa kodu

| Plik | Rola |
| --- | --- |
| `src/engine/smart-hints.js` | Wyszukiwanie, ocena, replay diagnostyczny, kontynuacja planu. |
| `src/engine/game.js` | `getLegalMoves`, `validateMove`, niemutujący `applyMove`, `isWon`, `assertInvariants`. Jedyny autorytet legalności. |
| `src/engine/cards.js` | `CardId`, `rank`, `suitIndex`, `color`, deterministyczne rozdanie. |
| `src/engine/knowledge.js` | `visibleCards`, `rememberVisible`; widoczność zgodna z rendererem. |
| `src/engine/progress.js` | Klucze stanów oraz oddzielny F04 `searchProgress`. |
| `src/session.js`, `src/persistence.js` | Historia, wiedza gracza, zapis/restore. Planer nie zmienia tych danych. |
| `src/app.js` | `requestSmartHint`, scheduler, budżety, anulowanie, pamięć ostatniego planu. |
| `src/ui/smart-hints.js`, `src/ui/render.js`, `src/ui/input.js` | Polski opis, podświetlenia i wykonanie pojedynczego ruchu przez gracza. |
| `tests/fixtures/smart-hints.js`, `tests/unit/smart-hints*.test.js`, `tests/e2e/smart-hints.spec.js` | Istniejące przypadki i regresje do zachowania. |
| `tests/helpers/smart-hint-bfs.js`, `scripts/audit-smart-hints.mjs` | Niezależny oracle osiągalności i audyt zapisanego stanu. |
| `scripts/hint-benchmark.js`, `scripts/benchmark-hints.mjs` | Replay i porównanie jakości/kosztu. |

`rankHints` w `src/engine/hints.js` pozostaje punktem odniesienia. Nie używaj go
jako awaryjnej sugestii jałowego ruchu, gdy SmartHint nie znalazł celu.

## Stan i komendy silnika

`CardId` to liczba całkowita 0–51: `suitIndex * 13 + rank - 1`.
Symbole mają kolejność trefl, karo, kier, pik; ranga 1–13.
Korzystaj z helperów kart zamiast powielać obliczenia.

```js
// Schemat danych, nie kod do dodania ani definicja TypeScript.
const state = {
  rulesVersion: 1, shuffleVersion: 1, seed, drawCount, // drawCount: 1 albo 3
  stock: [], waste: [],
  tableau: [/* dokładnie 7 obiektów { cards: [], faceUpStart } */],
  foundations: [[], [], [], []], // stała kolejność symboli
};
```

Wierzch każdej tablicy jest **na końcu**. Tableau ma zakryty prefix przed
`faceUpStart` i odkryty suffix od tego indeksu. Źródłowy `cardIndex` wskazuje
początek całego przenoszonego suffixu. Tylko ostatnia karta waste jest grywalna,
nawet jeśli widoczne są trzy. Bazy rosną od asa do króla; kartę można cofnąć
z bazy do legalnej kolumny. Pusta kolumna przyjmuje tylko króla/ciąg od króla.

```js
{ type: 'draw' }
{ type: 'recycle' }
{ type: 'move', from: { pile: 'tableau', index, cardIndex }, to: { pile: 'tableau', index } }
// Pozostałe źródła: { pile: 'waste' }, { pile: 'foundation', index }.
// Pozostały cel: { pile: 'foundation', index }.
```

`getLegalMoves(state)` zwraca komendy w stabilnej kolejności. `applyMove`
zwraca `{ok: true, state: nextState, revealed: CardId | null}` albo
`{ok: false, reason}`. Nie mutuje wejścia. Odsłonięcie tableau jest częścią
transferu i nie jest oddzielną komendą. Draw przenosi do trzech kart pojedynczo
z końca stock; recycle odwraca waste do stock, bez tasowania i bez dobrania.
Użyj tych funkcji również w symulacji; nie implementuj drugich zasad gry.
Undo/Redo nie należą do grafu wyszukiwania.

## Wiedza i granice informacji

Planer otrzymuje rzeczywisty stan, który technicznie zawiera zakryte ID, oraz
`session.knownCards`: unikalne ID kart widzianych wcześniej w tej partii.
Wiedza jest poza planszą; Undo nie usuwa pamięci, nowa/restartowana partia ją
resetuje. Znormalizuj wiedzę o karty widoczne w korzeniu. Podczas planowania
pozostaje stała; jej aktualizacja następuje dopiero po rzeczywistej akcji.

`visibleCards(state)` obejmuje odkryte tableau, karty baz i ostatnie
`drawCount` kart waste. Stock nie jest widoczny.

Zakryte ID traktuj jako tokeny tożsamości/kolejności lub do sprawdzenia pamięci.
Ich ranga, symbol i kolor nie mogą wpływać na ocenę, priorytet ani remisy.
Pamięć zakrytej karty nie daje prawa do punktowania jej przyszłych możliwości.

Każda gałąź kończy się na pierwszej granicy informacji:

- dowolne odsłonięcie tableau, także karty pamiętanej;
- draw, po którym pojawia się co najmniej jedna nieznana karta;
- zdjęcie wierzchu waste ujawniające nieznaną kartę pod wachlarzem.

Komenda przekraczająca granicę może być ostatnią komendą planu. Dalsze ruchy
tej gałęzi nie są analizowane. Znane dobrania i recycle mogą być przygotowaniem.
Na granicy oceniaj efekt strukturalny oraz możliwości wcześniej dostępnych
kart; maskuj nowe wartości także jako miejsca docelowe. Zakryta niepusta
kolumna nie może po maskowaniu stać się pustym miejscem dla króla.
Nowe tableau nie otrzymuje I: za odsłonięcie dostaje już H, niezależnie od pamięci.

## Publiczny kontrakt

Zachowaj zwykły generator JavaScript:

```js
searchSmartHint(state, knownCards = [], {
  maxStates = 10000,
  maxDepth = 32,
  signal,
  previousHint,
} = {})
```

Kontroler woła `.next()` w porcjach. Generator nie mierzy czasu, nie używa DOM
i nie wykonuje ruchów w sesji. Każdy yield zachowuje najlepszą zaakceptowaną
rekomendację. Gdy jeszcze jej nie ma, oddaje pusty wynik INCONCLUSIVE.
Fazy to `TEMPORARY`, `FINAL` i `CANCELLED`; tymczasowy wynik nie dowodzi
zakończenia przeszukiwania.

Wynik zawiera `{status, plan, goal, score, visitedStates, truncated}`.
Rekomendacja ma też `components: {H,F,I,W,M,B,L}`, `verification`,
`expectedPostRevealScore` i diagnostykę zgodną z obecnymi konsumentami.
Pierwszą sugestią jest `plan[0]`; cały plan jest listą komend silnika.

| Status | Znaczenie |
| --- | --- |
| `FOUND` | Legalny plan z dodatnim U osiąga `REVEAL` albo `FOUNDATION_ADVANCE`. |
| `EXPLORATION` | Dodatni plan zdobywa nową informację; `goal: 'INFORMATION'`. Nie obiecuje przyszłego dobrego ruchu. |
| `INCONCLUSIVE` | Nie znaleziono dodatniej rekomendacji; `plan: []`, `goal: null`, `score: null`. Także gdy cele istnieją, lecz mają U ≤ 0. |
| `NO_STRATEGIC_PROGRESS` | Graf wyczerpany bez żadnego celu H/F/I, `truncated: false`, pusty plan i `recommendedMove: null`. |
| `WON` | Plansza już wygrana; sprawdzenie przed wyszukiwaniem, pusty plan, bez sugestii. |

`truncated` oznacza rzeczywiste nieprzeszukane drogi przez limit głębokości,
stanów albo przerwanie czasowe. Może towarzyszyć FOUND/EXPLORATION.
Anulowanie przez `signal` zawsze ustawia `truncated: true`, `phase: 'CANCELLED'`
i zachowuje najlepszy legalny plan, również po skróceniu. Sygnał już anulowany
nie może zostać pominięty przez kontynuację zapamiętanego planu.
Brak planu po cięciu pozostaje INCONCLUSIVE, nigdy wynikiem negatywnym.

Zachowaj `analyzeHintPlan(state, knownCards, plan)`: replay tym samym silnikiem,
odrzucenie nielegalnej komendy lub ruchu po granicy informacji, zwrot
`{ok, state, goal, score, components, verification}` przy poprawnym replay.
To wspólna ocena planu i diagnostyka, bez wykonania w grze.

## Wyszukiwanie, deduplikacja i kompletność

Użyj ograniczonego Best-First Search, porównującego znalezione cele.
Neutralne i przejściowo ujemne stany nadal są rozwijane w ramach budżetu;
powrót z bazy może być potrzebnym pierwszym krokiem. Osiągnięcie awansu baz
nie zatrzymuje gałęzi, jeśli nie przekracza granicy informacji. Rozważ wszystkie
legalne komendy korzenia, chyba że przerwanie wymusza wynik ograniczony.

Zachowaj najlepszą drogę do stanu i stabilne remisy. Kolejka porównuje wyższy
priorytet, krótszy plan, mniejsze B, kolejność dodania. Deduplikacja odrzuca
stan osiągnięty wcześniej nie droższą ścieżką. Wykorzystaj `progressStateKey` lub
`progressKeyFor`: zachowują orientację kolumn, reguły/tryb, odkryte suffixy,
bazy, dokładny stock/waste i wiedzę; zakryty prefix tableau jest maskowany,
ponieważ wyszukiwanie zatrzymuje się przed użyciem jego wartości.

`maxStates` ogranicza zachowane różne stany, wliczając korzeń, oraz liczbę
rzeczywistych rozwinięć. `maxDepth` ogranicza wszystkie komendy, także draw
i recycle; respektuj również 0/1/2 w testach. Przestarzały wpis kolejki nie
liczy się jako rozwinięcie. Krótsza ścieżka może usunąć wcześniejsze cięcie
głębokości: na końcu rozlicz faktycznie brakujące następniki i nierozwinięte
stany. Sam pusty heap ani flaga historycznego trafienia limitu nie są dowodem
kompletności. Nie usuwaj ochrony statusu negatywnego dla uproszczenia algorytmu.

Przy stałym budżecie stanów, bez zegara, wynik i kolejność są deterministyczne.
Limit czasu zależy od urządzenia. Wersja może być wolna; nie może blokować
interakcji przez obliczenie całego grafu w jednym `.next()`.

## Ocena i wybór planu

Wszystkie różnice licz względem korzenia S0, a nie jako sumę bonusów za ruchy:

| Składnik | Znaczenie |
| --- | --- |
| H | Liczba odsłoniętych zakrytych kart tableau. |
| F | Liczba kart w bazach na końcu minus w S0, ze znakiem. Powrót tej samej karty do bazy nie daje zysku. |
| I | 1 za nieznane draw lub nową kartę w wachlarzu waste, inaczej 0. Nie mnożyć przez liczbę dobranych kart; tableau ma I=0. |
| W | Liczba różnych kart pochodzących ze stock/waste S0, które są na końcu w tableau/bazach po legalnym wyprowadzeniu. Bonus przygotowania, nie cel. |
| M | Nowe użyteczne możliwości względem S0. |
| B | Utracone użyteczne możliwości, których korzyść nadal nie została zrealizowana. |
| L | Liczba wszystkich komend; automatyczne odsłonięcie nie dodaje komendy. |

Użyteczna możliwość to legalny transfer bezpośrednio odsłaniający tableau lub
zwiększający bazy, identyfikowany przez początkową kartę ciągu i typ korzyści.
Równoważne miejsca docelowe nie mnożą wyniku. Wyklucz powrót karty do jej bazy
z S0. Zrealizowanie możliwości nie jest stratą B. Pusta kolumna sama w sobie
i przesuwanie króla między pustymi kolumnami nie dają bonusu.

```text
U = 120H + 40F_goal + 20I + 10M - E - 50B
priorytet kolejki = U + 65W - 3,5N
```

N to liczba draw/recycle. E wynosi 4 za transfer lub nieznane dobranie i 0,5
za znane dobranie/recycle. Dla celu REVEAL `F_goal` zachowuje ujemne F;
dodatnie F liczy najwyżej jako 1, tylko gdy końcowy odsłaniający transfer
jednocześnie idzie do bazy. Dla innych celów `F_goal = F`. Poboczne awanse
baz nie mogą wydłużać planu odsłonięcia dla bonusów. W nie wchodzi do U.
W kolejce znana nawigacja kosztuje łącznie 4, aby nie wypierała krótszych dróg.

Publikuj wyłącznie U > 0. Sama poprawa W/M nie tworzy celu.
Ostatnia komenda rekomendacji musi dodawać H, F lub I względem poprzednika;
nie dopisuj przygotowań po osiągniętym celu. Możesz rozwijać je w poszukiwaniu
kolejnych rzeczywistych celów.

Wspólny komparator wyników częściowych i końcowych:

1. Typ celu: REVEAL przed FOUNDATION_ADVANCE przed INFORMATION.
2. REVEAL: większe H, krótszy plan, większe `expectedPostRevealScore`, mniejsze
   B, większe U, stabilna kolejność.
3. FOUNDATION_ADVANCE: większe F, mniejsze B, krótszy plan, większe U, kolejność.
4. INFORMATION: krótszy plan, większa estymacja, mniejsze B, większe U, kolejność.

Estymacja po odsłonięciu to pomocnicza średnia dla jednej nieznanej karty,
wyłącznie na granicy informacji. Pula: ID 0–51 poza wiedzą i widocznymi kartami
korzenia, bez odczytu miejsc, gdzie leżą. Każda karta dostaje jedną korzyść:
2 za dopasowanie do bazy, inaczej 1,5 za króla przy pustej kolumnie, inaczej
1 za dopasowanie do znanego wierzchu tableau (ranga i przeciwny kolor), inaczej 0.
Podziel przez rozmiar puli; pusta pula daje 0. Pomiń właśnie odsłonięty wierzch
tableau, także pamiętany. Estymacja nie jest częścią U ani gwarancją sukcesu.
Optymalizacja liczników/masek jest szczegółem implementacji, nie powodem do
zmiany semantyki.

Sprawdzenie końca potwierdza legalność, rzeczywisty cel i dodatnie U.
**Dodatni awans baz wystarcza nawet bez dalszego osiągalnego celu.**
`verification.horizon` pozostaje 0; `continuation` opisuje
INFORMATION_BOUNDARY, WON, TERMINAL_PROGRESS albo UNPROVEN. To opis zakresu
weryfikacji, nie dowód przyszłego rozwiązania. Zachowaj pola diagnostyczne
obecnej wersji; `verificationReads`/`cachedDeadEnds` wynoszą 0, bez dodatkowego
przeszukiwania kontynuacji.

Zachowaj końcowe skracanie zwycięzcy: próbuj usuwać pojedyncze komendy przed
ostatnią i powtarzaj legalny replay. Wymagaj tego samego celu/granicy, H/F/I
nie mniejszych, B nie większego i U > 0. Dla końca bez granicy zachowaj dokładny
klucz końca i podzbiór wcześniejszych stanów pośrednich. Oddawaj sterowanie po
próbie i zachowuj sprawdzony plan przy anulowaniu. Raportuj
`shorteningAttempts`, `shortenedPlansCount`, `savedMovesCount`. Skracanie nie
gwarantuje globalnie najkrótszego planu.

Końcowy znaleziony wynik ma do 5 `alternatives`, zwycięzcę jako pierwszego.
Pozostałe są dodatnimi legalnymi planami na granicy informacji, różnymi po
pierwszej komendzie i celu, z własnym `verification`. To diagnostyka;
UI pokazuje jedną sugestię. Anulowanie i kontynuacja nie muszą mieć alternatyw.

## Kontynuacja, kontroler i UI

`previousHint` ma postać `{state: poprzedniKorzeń, plan: pokazanyPlan}`.
Jeśli obecna plansza jest wynikiem pierwszej komendy tego planu, sprawdź resztę
przez replay względem nowego korzenia. Jeśli jest legalna, mieści się w
`maxDepth`, kończy na właściwej granicy/celu i ma U > 0, zwróć ją jako
`continued: true`. Jeśli nie, uruchom zwykłe wyszukiwanie. Nie kontynuuj po
granicy informacji. To ogranicza oscylowanie wywołane zmianą S0; nie dowodzi
braku wszystkich możliwych cykli między planami.

Kontroler uruchamia analizę na żądanie „Podpowiedź”. Powtórny klik na tej samej
planszy/wiedzy pokazuje ten sam wynik. Obecne opcje `hintMaxStates`,
`hintMaxDepth`, `hintActiveMs`, `hintBatchMs` zachowują domyślnie
10000 / 32 / 100 ms aktywnej pracy / około 4 ms na porcję. Czas oczekiwania
na scheduler nie jest czasem aktywnych obliczeń. Wynik generatora ukończonego
w ostatniej porcji nie staje się ucięty tylko dlatego, że porcja przekroczyła
cel czasu. Przy rzeczywistym cięciu anuluj i odbierz zachowaną rekomendację.

Unieważniaj wyświetlany wynik po ruchu, Undo/Redo, nowej grze, restarcie,
restore, zmianie wiedzy/trybu. Pamięć planu dla sprawdzanej kontynuacji jest
oddzielna od wyświetlanego hint. Anuluj obliczenia przy pauzie, dialogu,
ukryciu strony i destroy. Stare żądanie nie może opublikować wyniku na nowej
planszy; sprawdzaj tożsamość żądania, planszę i wiedzę. Zegar nie restartuje
analizy. Wyliczenie hint nie zmienia historii, statystyk, wiedzy ani zapisu.

Zachowaj obecne podświetlenie źródła i celu, widoczny niemodalny polski opis
oraz live region. Opis podaje rzeczywistą pierwszą komendę, cel i długość:
„To pierwszy z dwóch ruchów, które pozwolą odsłonić kartę”. Nie ujawnia wartości
zakrytej karty. Dla EXPLORATION wyjaśnij zdobycie nowej informacji, nie obiecuj
rozwiązania. Użyj istniejącego `formatSmartHintMessage` i nazw kart.
Zachowaj 320 px, klawiaturę, fokus, gesty, zoom i reduced motion; aktualizacja
opisu nie przebudowuje DOM kart ani nie przerywa aktywnego gestu.

Plan nie wykonuje się automatycznie. Dwuklik/touch double-tap na źródle
aktualnej podpowiedzi wykonuje dokładnie jej pierwszy ruch raz, przez istniejącą
walidację i zwykłe komendy sesji. Stary hint po Undo/ruchu nie może się wykonać.

### Oddzielny kontrakt F04

`searchProgress` pozostaje oddzielną analizą osiągalności, bez heurystycznego
scoringu i bez limitu głębokości. Ma statusy PROGRESS_FOUND, NO_PROGRESS,
UNKNOWN, WON. SmartHint nie zastępuje ani nie osłabia tego dowodu.

- Tylko ukończony F04 NO_PROGRESS pozwala pokazać „Brak ruchów prowadzących
  do dalszego postępu.”. Pusta lista akcji ma osobne „Brak dostępnych ruchów.”.
- SmartHint INCONCLUSIVE: „Nie udało się znaleźć ruchu prowadzącego do postępu.”.
- SmartHint NO_STRATEGIC_PROGRESS: „Nie znaleziono posunięcia, które przybliża
  do rozwiązania.”, z sugestią nowej gry i warunkowo Undo przy `cursor > 0`.
- F04 PROGRESS_FOUND może współistnieć ze SmartHint INCONCLUSIVE.
  F04 UNKNOWN nie ostrzega o braku postępu. WON ma pierwszeństwo.

Żaden z wyników nie oznacza, że rozdanie jest niewygrywalne.

## Sprawdzenie i oddanie pracy

Zachowaj H01–H15 ze specyfikacji i istniejące testy. Nowe nietrywialne fragmenty
muszą mieć skupione testy zachowania. Szczególnie sprawdź:

- odkrycie bezpośrednie i po przygotowaniu, konieczny powrót z bazy,
  przygotowanie przejściowo ujemne;
- brak samodzielnej sugestii waste→tableau/króla między pustymi kolumnami
  i brak sztucznego zysku z baza→tableau→ta sama baza;
- jeden lub dwa rzeczywiste awanse baz, także terminalne bez dalszego celu;
- Draw 1/3, końcówki 1/2 kart, recycle i nieznana karta pod wachlarzem;
- ukryte permutacje przy tej samej obserwacji/wiedzy: identyczny wynik, score
  i kolejność dla stałego budżetu; pamiętany zakryty wierzch nie zmienia H/I/U;
- maskowanie nowych wartości w M/B i miejscach docelowych, niemutowanie
  zamrożonych wejść, legalność każdego planu;
- limity zachowanych stanów/rozwinięć, głębokość 0/1/2 i dłuższe przygotowania,
  rozwiązane cięcie po krótszej ścieżce oraz nadal brakujący następnik;
- każdy yield i anulowanie zachowują najlepszy zaakceptowany plan;
  anulowanie po skróceniu i anulowany sygnał przed kontynuacją;
- kontynuacja po wykonanym pierwszym ruchu, fallback po odrzuconym ogonie,
  brak oscylacji w zapisanych regresjach;
- stale results, Undo/Redo/reload, powtórne kliknięcia, zegar, WON/F04,
  polski opis, live region, 320 px i gest wykonania jednej komendy.

Nie porównuj całego wyniku przy różnej wiedzy, zakładając identyczność
estymacji: dopełnienie wiedzy może ją legalnie zmienić. Ochrona zakrytego tableau
wymaga niezmiennego H/I/U i braku użycia jego rzeczywistej nowej wartości.

Wykorzystaj zapisane fixture seed1/cursor76, seed21/cursor61, seed2560240634/
cursor78 oraz oba `solitaire-stan-*` w `tests/fixtures`. Diagnostykę odtwarzaj
przez `restoreSession(JSON.stringify(diagnostic.save))` z `src/persistence.js`;
sprawdź `ok`, potem użyj `result.session.state` i `knownCards`. Nie nadpisuj
zapisu gracza. Cursor73 jest audytem pełnego grafu: przy debug 250000 stanów /
100 komend dotychczasowy planner i niezależny BFS wyczerpują 88896 stanów bez
celu. To regresja osiągalności, nie dowód jakości wszystkich podpowiedzi.

Uruchom istniejące skrypty i zapisuj rzeczywiste wyniki:

```powershell
npm test
npm run build
npm run test:e2e
git diff --check
```

Najpierw można uruchamiać odpowiednie `tests/unit/smart-hints*.test.js`;
pełna weryfikacja jest bramką oddania implementacji, chyba że koordynator
wyraźnie ograniczy ją w nowym przypisaniu. Niezależny BFS i testy F04 muszą
pozostać zgodne; samo porównanie planera z jego własną oceną nie wystarczy.

Po zmianie algorytmu porównaj jakość i koszt z poprzednią rewizją na identycznych
zapisanych pozycjach oraz seedach 0–99 w Draw 1/3, do 100 komend, przy tych samych
budżetach i aktualizacji wiedzy dopiero po wykonanych akcjach. Użyj istniejącego
harnessu; ustal baseline po jego faktycznej rewizji, nie po nazwie „previous”.
Obecny `benchmark:hints` ma historyczny baseline `90fba4f`, więc sam ten skrypt
nie zastępuje porównania z wersją sprzed Twojej zmiany. Odtwarzalny profil:

```powershell
npm run benchmark:hints -- --profile=full --budget=both --output=.cache/hints-implementation.json
```

Zapisz reveals, postęp baz, powroty do planszy oraz planszy+wiedzy, komendy,
zatrzymania/statusy, wygrane, medianę/p95 aktywnego czasu i odsetek cięć.
Podaj środowisko, seedy, limity i identyfikatory źródeł. Brak poprawy szybkości
nie przekreśla zgodnej implementacji; nie przedstawiaj cięć jako dowodu braku
postępu. Pełny benchmark może być osobnym krokiem, jeśli koordynator go odroczy;
oznacz wtedy brak dowodu. Chromium/emulacja nie zastępują fizycznego
touch/Safari; nie obiecuj mobilnego czasu 100 ms bez pomiaru.

Na koniec uzupełnij raport T028 o zakres, dokładne komendy/wyniki, ograniczenia
i instrukcję wznowienia; zsynchronizuj TASKS, STATUS i HANDOFF zgodnie z
AGENTS.md. Sprawdź staged diff, stage'uj jawne ścieżki i commituj z prefiksem
`T028:`. Nie pushuj bez aktualnego polecenia koordynatora. Oddaj do REVIEW;
DONE wymaga zapisanej akceptacji koordynatora. Nie zaczynaj następnego zadania.
