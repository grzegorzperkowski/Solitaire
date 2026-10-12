# T028 — audyt grafu SmartHint, 2026-10-12

Status: REVIEW po wykonaniu sprawdzeń; oczekuje na akceptację koordynatora.
Koordynator zaakceptował `c677cad` (stale queue entries/H07) i przypisał osiem
poniższych punktów. Praca sekwencyjna na `master`, bez zmiany limitów, wag,
definicji statusów, silnika, schematu zapisu ani zasad informacji.

## Wyniki według zgłoszenia

### 1. Trwałe truncated — CONFIRMED

- Scenariusz: S→A→B→C→X trafia na maxDepth=3; później S→Short→X rozwija X
  na głębokości 2. Wariant kontrolny: X→Missing→Unseen pozostawia prawdziwe
  odcięcie. Wysoka ocena A/B/C wymusza sprawdzenie dłuższej drogi wcześniej.
- Przed zmianą: kompletny wariant zachowywał `truncated: true`, a C tracił
  krawędź do X i pozostawał niekompletny. Potwierdzone nieprzechodzącą regresją.
- Przyczyna: historyczna flaga była trwała; odcięty, jeszcze nieznany następca
  nie trafiał do `children`. Późniejsze rozwinięcie X nie naprawiało C.
- Zmiana: zachować klucz każdej dozwolonej krawędzi, zapisać koszt rozwinięcia,
  przeliczyć kompletność przed weryfikacją. `truncated` wynika z brakujących
  następców i nierozwiniętych najlepszych ścieżek, następnie ewentualnego limitu
  odczytów weryfikacji. Historyczne liczniki limitów nadal zostają.
- Regresja: wariant rozwiązany jest nieobcięty, C.complete=true i C.children
  zawiera X. Wariant z Unseen pozostaje obcięty, Missing.complete=false,
  unresolvedCutoffs=1 i kontynuacja UNPROVEN. Nie zamienia niepewności w impas.

### 2. Kontynuacja przez S0 — CONFIRMED

- Scenariusz: Candidate(F=1, W=1)→Step→S0→Alternative(F=2). Wyższe U kandydata
  sprawiało, że wygrywał dzięki celowi osiąganemu dopiero inną gałęzią z S0.
- Przed zmianą: FOUND / FUTURE_GOAL_REACHABLE. Przyczyna: odczyt grafu
  przechodził przez korzeń i kwalifikował cel alternatywy jako dalszy zysk.
- Zmiana: wykluczyć S0 z odczytu kontynuacji. Kandydat może dalej osiągnąć
  ujawnienie, nową informację lub większe F; nie może potwierdzić tego objazdem
  przez stan, z którego już można było wybrać alternatywę.
- Regresja: kandydat jest odrzucony jako KNOWN_DEAD_END. Alternatywa z samym
  bezpośrednim powrotem do S0 także jest odrzucona zgodnie ze specyfikacją;
  wynik INCONCLUSIVE, pusty plan, truncated=false. Dodatkowa regresja zachowuje
  FOUND / FUTURE_GOAL_REACHABLE dla rzeczywistej drogi do informacji i nie
  wykonuje żadnego ruchu za jej granicą.
- Dodatkowo CONFIRMED: po wykluczeniu korzenia pozostający na stosie S0 mógł
  fałszywie wyczerpać limit weryfikacji. Pętla usuwa teraz korzeń/duplikaty przed
  sprawdzeniem budżetu. Przy maxStates=4 oba końce zamkniętego cyklu są odrzucone
  po dokładnie 4 odczytach, bez fałszywego truncated. Naprawa ma własną regresję.

### 3. Kompletność, alternatywy i granice informacji — CONFIRMED / NOT REPRODUCED / INTENTIONAL

- CONFIRMED: brakujące krawędzie i nieaktualne complete opisane w punkcie 1.
  Sprawdzenia obejmują sam prywatny graf, nie tylko publiczny status.
- CONFIRMED: przy maxStates=6 dwa zapamiętane cele bazowe tworzą martwy cykl,
  a późniejszy nieznany draw nie mieści kolejnej planszy w visited. Kandydatura
  EXPLORATION znikała, bo candidates przechowywało tylko zapamiętane końce,
  a bestResult należał do FOUND. Po odrzuceniu FOUND nie pozostawała alternatywa.
  Teraz zachowywane są metadane celów również poza limitem plansz; dla tego
  samego klucza zostaje lepszy wynik. Nie rozwijamy dodatkowych plansz.
  Regresja zwraca EXPLORATION / INFORMATION_BOUNDARY, truncated=true.
- NOT REPRODUCED: niezgodność deduplikacji z pełnym kluczem mechaniki.
  Na 28 rzeczywistych małych planszach zgadzają się unikalne stany i liczby
  wszystkich celów H/F/I. Nie stwierdzono powodu do zmiany progressStateKey
  ani wag. To dowód dla badanych plansz, nie formalny dowód dla wszystkich gier.
- INTENTIONAL: każdy reveal tableau kończy gałąź, także jeśli karta była
  zapamiętana. Nowa informacja z draw/waste także kończy gałąź. Weryfikacja nie
  rozwija takich końców; testy sprawdzają puste children węzłów granicznych,
  remembered reveal oraz dotychczasowe permutacje nieznanych kart. Ukryte ID
  są jedynie tokenami klucza, nigdy podstawą do oceniania rang/kolorów.

### 4. Anulowanie weryfikacji — CONFIRMED

- Scenariusz: wcześniej lokalnie sprawdzony Safe, następnie lepiej punktowane
  Dead/DeadStep; oba końce zostają odrzucone przez graf. Kolejna kandydatura ma
  lokalnie odrzucony koniec. Anulowanie po kolejnych yield między kandydatami.
- Przyczyna: zerowanie bestResult usuwało dostęp do Safe. Po yield nie było
  natychmiastowego sprawdzenia signal, więc możliwy był replay kolejnego końca
  lub przejście do następnej iteracji bez zachowanego poprawnego planu.
- Zmiana: zachować lokalnie sprawdzone alternatywy w osobnej mapie; usuwać je
  przy odrzuceniu przez graf/replay. Sprawdzać signal natychmiast po yield.
- Regresja: anulowanie po KAŻDYM yield ma cancelled=true / truncated=true,
  zwraca wyłącznie lokalnie zweryfikowaną, nieodrzuconą kandydaturę; po wejściu
  w końcową selekcję wraca Safe, nigdy Dead/DeadStep ani odrzucony Rejected.
  Przy kilku poprawnych alternatywach wraca ostatnia zweryfikowana (Newer,
  nie Older); ma to osobną regresję. Osobny 65-węzłowy łańcuch potwierdza anulowanie dokładnie przy yield po 64
  odczytach, bez dalszych odczytów. Częściowy plan nie jest gwarancją wygranej
  ani dowodem pozytywnej końcowej kontynuacji; jego zakres opisuje verification.

### 5. stateCount — CONFIRMED

- Scenariusz: sześć zapamiętanych stanów; X jest rozwinięty długą drogą,
  następnie znaleziony krócej i ponownie czeka w kolejce. maxStates=6.
- Przed zmianą visitedStates=7 mimo tylko sześciu rzeczywistych rozwinięć.
  Przyczyna: inkrementacja przed sprawdzeniem przekroczenia.
- Zmiana: sprawdzić stateCount >= maxStates przed inkrementacją. Nadal pomijać
  stale queue entries przed licznikiem — zaakceptowana poprawka pozostaje.
- Regresja: visitedStates=6, truncated=true z rzeczywiście nierozwiniętą
  najlepszą ścieżką. Nie zwiększono budżetu.

### 6. Nieudany replay — CONFIRMED (odporność)

- Scenariusz: po yield między kandydatami testowy silnik odrzuca replay
  kandydatury, która dotychczas miała tylko wstępną verification.
- Przed zmianą TypeError przy odczycie replay.verification.accepted.
  Przyczyna: analyzeHintPlan może zwracać ok=false bez verification.
- Zmiana: sprawdzić replay.ok, odrzucić kandydaturę, usunąć jej bezpieczny
  odpowiednik i zwiększyć rejectedEndStates; kontynuować wybór alternatyw.
- Regresja: brak wyjątku; błędny koniec nie wraca, wcześniejszy Safe pozostaje.
  Normalne odtworzenie niezmiennego stanu deterministycznym silnikiem nie powinno
  zawieść; wymuszony błąd sprawdza obsługę tego kontraktu, nie wskazuje uszkodzenia silnika.

### 7. Niezależny BFS — NOT REPRODUCED: pominięcie osiągalnego celu

- Oracle: FIFO, pełny klucz [rulesVersion, drawCount, tableau z pełnymi ID,
  foundations, stock, waste]. Nie importuje SmartHint, jego klucza, heurystyki,
  evaluatorów ani weryfikacji; korzysta z tych samych legalnych komend silnika.
  Cele liczy strukturalnie względem korzenia, zatrzymuje się na reveal/nowej
  informacji. Nie interpretuje zakrytych wartości. Deduplikuje przed enqueue.
- Macierz: fixtures 1–7 × Draw 1/3 × wiedza widoczna/wszystkie karty zapamiętane.
  Wszystkie 28 grafów wyczerpane przy kontrolnym cap=1000; SmartHint używa
  maxStates=1000, maxDepth=30. Zgodne liczby unikalnych stanów i celów H/F/I.
  Dodatkowy test remembered reveal potwierdza 2 rozwinięcia, 4 unikalne stany,
  2 cele H i 0 celów I, bez przekroczenia granicy.
- BFS bada osiągalność celu, nie zasadność rekomendacji. INTENTIONAL: osiągalny
  cel o niedodatnim U lub z odrzuconym martwym końcem może dać INCONCLUSIVE.
  Nie znaleziono przypadku BFS>0 kontra nieobcięte NO_STRATEGIC_PROGRESS.

### 8. Seed 2560240634, Draw 1, cursor 73 — NOT REPRODUCED: pominięcie postępu

Fixture odtworzony przez istniejącą walidację save/history, bez modyfikowania
sesji gracza. Baseline to zaakceptowane `c677cad`; oba SmartHint używają tych
samych wcześniejszych parametrów debugowych: maxStates=250000, maxDepth=100.
BFS ma cap=250000 i nie ma limitu głębokości. Żaden cap nie został osiągnięty.

| Pomiar | Przed | Po | Niezależny BFS |
| --- | ---: | ---: | ---: |
| Status | NO_STRATEGIC_PROGRESS | NO_STRATEGIC_PROGRESS | brak celu po wyczerpaniu |
| Powód | SEARCH_EXHAUSTED | SEARCH_EXHAUSTED | pełny FIFO |
| truncated | false | false | false |
| Rozwinięcia | 88 896 | 88 896 | 88 896 |
| Unikalne stany | 88 896 | 88 896 | 88 896 |
| Nieaktualne wpisy | 0 | 0 | nie dotyczy |
| Nierozwiązane odcięcia | 0* | 0 | 0 |
| Nierozwinięte stany | 0* | 0 | 0 |
| Cele H/F/I | 0/0/0 | 0/0/0 | 0/0/0 |
| Czas (ms) | 32 210 | 34 849 | 34 453 |

\* Baseline nie miał nowych liczników; jego zero wynika z braku historycznych
trafień depth/state limit, pełnego opróżnienia kolejki i truncated=false.
Nowa implementacja mierzy brakujące krawędzie oraz nierozwinięte najlepsze
ścieżki bezpośrednio. Historyczne depth/state cut counters także wynoszą zero.
Oba SmartHint odrzuciły 551 857 duplikatów, znalazły 88 895 stanów
przygotowawczych i wykonały zero odczytów weryfikacji celów.
Czasy są pojedynczym pomiarem podczas pracy/testów, nie benchmarkiem wydajności.

**Wniosek:** nie ma dowodu na pominięcie osiągalnego H/F/I dla cursor 73.
Pełny BFS ze ścisłym kluczem mechaniki potwierdza aktualne SEARCH_EXHAUSTED.
Nie dowodzi to niewygrywalności rozdania i nie bada wcześniejszych decyzji/Undo.

## Sprawdzenia i odtwarzanie

- RED: `npm test -- tests/unit/smart-hints-graph.test.js` — potwierdzone błędy
  statusu/truncated, utrata kandydatury, TypeError i visitedStates=7; następnie
  każda naprawa uzyskała własną zieloną regresję.
- `npm test -- tests/unit/smart-hints-graph.test.js` — 11 passed przed ostatnią
  regresją wyboru najnowszej bezpiecznej alternatywy.
- `npm test -- tests/unit/smart-hints-bfs.test.js` — 29 passed.
- `npm test` — 265 passed w 18 plikach. Po końcowym doprecyzowaniu kolejności
  fallback anulowania: `npm test -- tests/unit/smart-hints-graph.test.js tests/unit/smart-hints-bfs.test.js`
  — 41 passed (12 grafowych i 29 BFS); build ponownie passed.
- `npm run build` — passed.
- `npm run test:e2e -- tests/e2e/smart-hints.spec.js tests/e2e/progress.spec.js tests/e2e/play.spec.js` — 45 passed, Chromium.
- `node scripts/audit-smart-hints.mjs tests/fixtures/solitaire-stan-2560240634-draw1-73.json | Tee-Object -FilePath .project/reports/T028-cursor73-audit.jsonl` — trzy pełne wyszukiwania; surowe liczniki/czasy w JSONL.
- `git diff --check` — wynik końcowy w głównym raporcie T028.

Granice: sterowane grafy testują bookkeeping, rzeczywiste reguły sprawdza
niezależny BFS. BFS współdzieli silnik legalnych ruchów, więc nie wykryje jego
ewentualnego wspólnego błędu. Nie powtórzono benchmarku jakości 100 seedów ani
pomiarów na fizycznym telefonie. Nie zmieniano obcych CSS/E2E accessibility ani
nieśledzonego JSON cursor-114. Nie publikowano i nie wykonywano push.
