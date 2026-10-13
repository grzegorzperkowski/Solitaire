# T028 — weryfikacja analizy zewnętrznej, 2026-10-13

Status: REVIEW; bez zmiany algorytmu, oczekuje na akceptację koordynatora.

Koordynator wznowił SmartHint słowami „musimy trochę poprawić smart hint” i
przekazał osiem zarzutów oraz proponowany diff. Sprawdzono bieżący kod na
`master` od `86896dc`, kontrakty T028 §3–§6, wszystkie wywołania planera,
silnik, wiedzę, klucz stanów, regresje grafowe i niezależny BFS. T014/T027 mają
zapisaną akceptację. Jedyna początkowa obca zmiana to nieśledzony
`solitaire-stan-2284836135-draw1-114.json`; plik pozostawiono bez zmian.

## Ocena ośmiu zarzutów

1. **Zamrożone H/F/I — brak potwierdzonego błędu.** H jest funkcją zmian
   `faceUpStart`/rozmiaru kolumn, F jest różnicą liczby kart w bazach, a wiedza
   korzenia jest stała. Węzły rozwijane przed pierwszą granicą mają H=I=0;
   nie można wrócić do rozwijanego P po wcześniejszym odkryciu H=1, ponieważ
   `checkBoundary` zatrzymuje taką gałąź. Ten sam mechaniczny stan ma ten sam F,
   nawet jeśli po drodze cofnięto kartę z bazy. Krótsza droga aktualizuje visited
   i expandedCost; regresja sprawdza ponowne rozwinięcie oraz zachowanie dzieci.

2. **Przeliczenie truncated — celowe domknięcie grafu, nie utrata dowodu.**
   Licznik historycznych odcięć nie mówi, czy w końcowym grafie czegoś brakuje.
   Jeśli późniejsza droga zapamięta i rozwinie brakującego następcę, odcięcie
   jest rozwiązane. Jeśli wszystkie legalne krawędzie liścia prowadzą do
   istniejących, rozwiniętych węzłów, graf jest zamknięty; cykl nie tworzy
   pominiętego stanu tylko dlatego, że jego ponowne przejście przekracza
   maxDepth. Nieznany następca pozostaje w children, a nierozwinięta najlepsza
   droga daje unexpandedStates>0. Regresje rozróżniają rozwiązane i rzeczywiste
   odcięcia oraz sprawdzają maxStates bez przekroczenia licznika rozwinięć.
   Trwałe cut/hitStateLimit z proponowanego diffu konserwatywnie zmieniają ten
   kontrakt i psują rozróżnienie pełnego grafu od historycznego trafienia limitu.

3. **Odrzucenie ostatniego awansu — świadoma polityka rekomendacji.** §5 wymaga
   dalszego postępu w zamkniętym podgrafie kandydata. Osiągalny F=1 bez dalszej
   kontynuacji może dać INCONCLUSIVE, ale nie NO_STRATEGIC_PROGRESS. Powrót z
   bazy i dołożenie innej karty przy takim samym łącznym F nie jest dalszym
   przyrostem baz w obecnej definicji. `excluded` zapobiega potwierdzaniu
   kandydata przez powrót do przodka i wybór pierwotnej alternatywy.

4. **Odrzucenie U<=0 — świadomy próg, nie test osiągalności.** §5 jawnie zachowuje
   U>0 i wskazuje fixture seed21/cursor61: usunięcie progu wywołuje pętlę
   podpowiedzi. Długi INFORMATION może otrzymać niedodatnie U; jest to
   ograniczenie heurystyki, nie dowód braku celu. Liczniki celów pozostają
   dodatnie niezależnie od score, więc wynik bez rekomendacji to INCONCLUSIVE.
   Zmiana tej polityki potrzebuje osobnej kalibracji oraz testu przeciw pętlom.

5. **Maskowanie przeniesionej K — scenariusz przekracza granicę informacji.**
   Przed pierwszym odkryciem zakryty prefiks kolumny pozostaje na miejscu.
   Transfer odsłaniający usuwa odkryty sufiks i natychmiast kończy plan; nie
   można następnie położyć K w skróconej kolumnie. `replayPlan` odrzuca akcje po
   granicy. Stąd index<root.faceUpStart maskuje właśnie pierwotnie zakryte
   karty. Maskowanie także zapamiętanej nowo odsłoniętej karty jest wymagane
   przez §4: nie oceniać jej przyszłej mobilności na tej granicy.
   **Potwierdzona regresja w proponowanym diffie:** warunek !knownSet.has(id)
   dopuszcza ocenę takiej karty. Dla seedów 0/44, Draw 1, knownCards=0..51,
   pojedynczy reveal daje w obecnym kodzie M=0, a po samym proponowanym
   maskowaniu M=1 (score 156→166 i 116→126). Porównanie wykonano na module
   załadowanym w pamięci; pliku produkcyjnego nie zmieniono.

6. **Równe score przy krótszej drodze — brak reprodukcji dla legalnego grafu.**
   Dla tego samego osiągalnego końca i stałego korzenia składniki poza L są
   takie same, a krótsza droga zwiększa U o 4 na komendę. Pierwsza granica jest
   terminalna; zaproponowane warianty z ruchem po reveal są niedopuszczalne.
   Zagłodzenie gałęzi przez kolejkę best-first pozostaje ograniczeniem jakości
   przy małym budżecie, zapisanym w specyfikacji; nie uzasadnia samo w sobie
   fałszywego SEARCH_EXHAUSTED ani zmiany wag bez pomiarów.

7. **Anulowanie w trakcie UNPROVEN — trafnie opisane ograniczenie kontraktu.**
   Aktualne §5 pozwala zwrócić kandydaturę sprawdzoną lokalnie i jeszcze
   nieodrzuconą przez graf. accepted=true nie dowodzi dodatniej kontynuacji;
   verification.continuation=UNPROVEN i truncated=true pokazują zakres dowodu.
   Test przy 64 odczytach świadomie oczekuje takiego częściowego planu.
   Przeniesienie tylko końcowego wpisu do verifiedCandidates nie realizuje
   proponowanej silniejszej polityki: candidate jest nadal przekazywany do
   cancelledResult, a mapa zawiera lokalne kandydatury z głównego wyszukiwania.
   Wymaganie wyłącznie ukończonej weryfikacji grafowej zmieniłoby też zachowanie
   produkcyjnego limitu czasu podczas głównego wyszukiwania; to osobna decyzja
   produktu, nie bezpieczna lokalna poprawka przedstawionego diffu.

8. **Klucz i kontynuacja — odczytano importy; brak potwierdzonej kolizji.**
   Klucz zachowuje indeksy/faceUpStart wszystkich kolumn, widoczne ID, dokładne
   uporządkowane stock/waste, bazy, rulesVersion/drawCount i posortowaną wiedzę.
   Maskuje wyłącznie aktualnie zakryte ID tableau, których wartości nie mają
   znaczenia przed granicą. Nie sortuje kolumn. Silnik operuje na przenoszonych
   widocznych sufiksach; undefined w masce blokuje ocenę rangi, nie odsłania
   niższych kart waste. Puste kolumny mają osobne legalne miejsca docelowe.
   analyzeHintPlan/continuePlan oferują lokalny kontrakt, nie ponowny pełny
   dowód grafowy; wcześniejsze regresje odrzucania ogona i pre-abort przechodzą.

## Pozycja 73 — nowe pomiary

`node scripts/audit-smart-hints.mjs tests/fixtures/solitaire-stan-2560240634-draw1-73.json`
zakończyło się kodem 0. Skrypt jawnie używa **maxStates=250000/maxDepth=100**,
nie produkcyjnych 10000/30 ani zakładanych w analizie 10000/12.

| Wynik | Baseline c677cad | Obecny SmartHint | Niezależny BFS |
| --- | ---: | ---: | ---: |
| Rozwinięte stany | 88896 | 88896 | 88896 |
| Unikalne stany | 88896 | 88896 | 88896 |
| Cele H/F/I | 0/0/0 | 0/0/0 | 0/0/0 |
| truncated | false | false | false |
| Czas, ms | 14386 | 13462 | 12705 |

Oba SmartHint: NO_STRATEGIC_PROGRESS/SEARCH_EXHAUSTED; staleQueueEntries,
depthLimitedBranches, stateLimitedBranches i rejectedEndStates są zerowe.
Obecny SmartHint: unresolvedCutoffs=unexpandedStates=nonPositiveGoals=0,
verificationReads=0. Oba odrzucają 551857 duplikatów. Wszystkie trzy hipotezy
dotyczące tej pozycji nie potwierdziły się. Czasy to pojedyncze pomiary przy
równoległym uruchomieniu testów, nie porównawczy benchmark wydajności.

## Zmiany i faktyczne sprawdzenia

Zachowano algorytm, limity, wagi i zasady gry. Dodano dwa przypadki seed0/44
do tests/unit/smart-hints.test.js: nowo odsłonięta zapamiętana karta nie wnosi M,
granica ma horizon=0 i INFORMATION_BOUNDARY. Testy zabezpieczają §4 przed
proponowaną regresją, nie są deklaracją naprawy wcześniej wadliwego runtime.

- Pierwszy sześcioplikowy zestaw poniżej: 99 passed, 6 plików, exit 0.
- In-memory comparison obecnego/proponowanego maskowania: obie plansze miały
  H=1/I=0/M=0/B=0 obecnie, H=1/I=0/M=1/B=0 po proponowanej zmianie. Pierwsza
  próba użyła nieistniejącego importu deal.js i zakończyła się ERR_MODULE_NOT_FOUND;
  ponowiono z właściwym cards.js. Bez zmian źródeł produkcyjnych.
- `npm test -- tests/unit/smart-hints.test.js -t 'remembered tableau reveals'`:
  2 passed, 33 skipped, exit 0.
- `npm test -- tests/unit/smart-hints.test.js tests/unit/smart-hints-graph.test.js tests/unit/smart-hints-bfs.test.js tests/unit/smart-hints-continuation.test.js tests/unit/smart-hints-goal-endpoint.test.js tests/unit/smart-hints-app.test.js`:
  **101 passed**, 6 plików, exit 0. Obejmuje 29 niezależnych małych BFS,
  realny kontroler, kontynuację, anulowanie, endpoint, limity i maskowanie.
- Audyt cursor73: wyniki powyżej, exit 0.
- `git diff --check`: exit 0; staging sprawdzany przed commitem T028.

Nie uruchamiano pełnej suite, build, E2E, benchmarku 100 seedów ani fizycznych
urządzeń. Runtime nie zmienił się; wcześniejszy zakres v3 pozostaje odroczony.
Oracle współdzieli silnik ruchów, więc nie wyklucza wspólnego błędu silnika.
Osiągalność i rekomendacja pozostają różnymi kontraktami; UNPROVEN nie jest
gwarancją bezpieczeństwa strategicznego ani wygranej. Brak push/publikacji.

Wznowienie: po przypisaniu przez koordynatora można osobno zmienić politykę
U<=0, ostatniego awansu lub anulowania UNPROVEN, z odpowiednią specyfikacją,
reprodukcją i testami. Nie rozpoczynać tego automatycznie. Raport nie jest
akceptacją T028 ani dowodem zakończenia odroczonej kalibracji.
