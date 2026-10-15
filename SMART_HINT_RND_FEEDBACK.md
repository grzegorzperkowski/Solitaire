# Smart Hint — wyniki eksperymentu BFS i prośba o diagnozę

Kontynuujemy R&D algorytmu podpowiedzi do Klondike. Zaimplementowaliśmy i zmierzyliśmy izolowany wariant FIFO/BFS zaproponowanego kierunku. Pomóż ustalić przyczyny gorszych wyników i zaproponować następny mały, falsyfikowalny eksperyment. Odpowiedz po polsku. Odróżniaj fakty wynikające z kodu i pomiarów od hipotez.

Do tej wiadomości dołączam:

- `SMART_HINT_BFS_CODE.md`: pełny, faktycznie badany moduł BFS, wszystkie jego zależności silnika, rdzeń benchmarku oraz dokładną klasę kolejki bazowego planera. Możesz odtworzyć oba warianty bez zgadywania funkcji pomocniczych.
- `T028-bfs-diagnostics.json`: trzy konkretne pozycje, komendy od ziarna, aktualna wiedza, rzeczywiste wyniki obu wyszukiwań na tej samej planszy i ich diagnostyka. Techniczne stany zawierają też ukryte ID; nie wolno wykorzystywać ich rang/kolorów w proponowanej strategii.

## 1. Co dokładnie testowaliśmy

Bazą jest działający planer `2d1ecfc`. Wariant eksperymentalny zamienia WYŁĄCZNIE wewnętrzną kolejkę priorytetową na FIFO. Nie jest to pełna implementacja całej Twojej ostatniej propozycji. Nie wyciągamy wniosku, że wszystkie jej pomysły zawiodły.

W obu wariantach zachowaliśmy:

- Deduplikację według długości ścieżki w komendach, a nie ważonego kosztu. Bazowy Best-First już przyjmuje ponownie stan osiągnięty krótszą drogą. FIFO ma asercję niemalejącej głębokości zdejmowanych węzłów.
- Dotychczasową ocenę, dodatni próg U dla nowych planów, wybór celów, estymację po odkryciu i ocenę utraconych możliwości B. Wybór celu: rzeczywista wygrana przed wszystkim, potem REVEAL, FOUNDATION_ADVANCE, INFORMATION. Szczegółowe remisy i składniki są w kodzie, nie zastępuj ich hipotetycznym Q.
- Końcowe skracanie wybranego planu, ochronę przed dopisywaniem przygotowań po celu i rozliczanie nierozwiązanych cięć grafu.
- `createHintContext`: odwiedziny i maksimum baz od ostatniej epoki nowej informacji/odkrycia, odbudowane z aktywnych snapshots. Nie jest to maksimum całej partii. Historia nie zakazuje przejść przez dawne plansze.
- `previousHint` i pierwotny certyfikat `commitment:{state,plan}`. Zweryfikowany pozostały fragment planu może mieć ujemne lokalne U; nowy plan nadal wymaga dodatniego U. Nie usuwaj certyfikatu, bo sam ostatni fragment nie zachowuje uzasadnienia pierwotnej akceptacji.
- Legalne cofnięcia z baz, znane draw/recycle i ruchy przygotowawcze, również przejściowo pogarszające pozycję.
- Granice informacji: każde odkrycie tableau kończy gałąź, także zapamiętanej karty; ujawnienie nieznanej karty stock/waste również. Nie planujemy zagrania nowo poznanej karty w tej samej sekwencji. Wiedza podczas pojedynczego wyszukiwania jest stała.
- `INCONCLUSIVE` przy ograniczeniu zasobów lub odrzuceniu celów. `NO_STRATEGIC_PROGRESS` wymaga pełnego wyczerpania grafu bez celu kontraktowego; nie oznacza niewygrywalności. Osobny F04 nie został zmieniony.

Nie dodaliśmy ważonej Dijkstry, nowych wag Q, liczników historycznych krawędzi, nowego zapisu sesji, probabilistycznego solvera ani zaproponowanego wspólnego licznika całej pracy/replay. Porcjowanie pozostało bazowe. W źródle BFS pozostał historyczny komentarz o kopcu nad klasą kolejki; faktyczna implementacja tej klasy jest FIFO.

## 2. Jak rozgrywaliśmy partie

Node v22.22.0. Te same ziarna i tryby dla obu wariantów. Każda analiza otrzymuje aktualną wiedzę i kontekst odbudowany z faktycznej historii. Po wyniku wykonujemy tylko `plan[0]`, aktualizujemy wiedzę i ponawiamy. Cały reklamowany plan jest sprawdzany przez niezależny replay silnika i niezmienniki. Algorytmy dostają te same limity; kolejność uruchomienia par jest naprzemienna.

- Długość planu: maksymalnie 32 komendy.
- Limit przebiegu partii: 500 komend; żaden z badanych przebiegów nie doszedł do tego limitu.
- Budżet jest deterministyczny, bez limitu 100 ms. `maxStates` zachowuje bazowy kontrakt ograniczający liczbę zachowanych różnych stanów, w tym granicznych, oraz liczbę rozwinięć. To nie jest jednakowy budżet przejść ani czasu.
- Część testów/build działała równolegle z pomiarem stałej pracy. Nie interpretujemy czasów jako dowodu szybkości.

## 3. Wyniki całych partii

| Limit stanów | Ziarna, oba tryby | Bazowy wygrywa | FIFO wygrywa | Bazowy INCONCLUSIVE | FIFO INCONCLUSIVE |
| ---: | --- | ---: | ---: | ---: | ---: |
| 512 | 200–219, 40 rozdań | 9 | 3 | 23 | 29 |
| 2048 | 200–219, te same 40 rozdań | 11 | 3 | 16 | 27 |
| 10000 | 200–204, podzbiór 10 rozdań | 4 | 1 | 1 | 4 |

Porównanie sparowane:

| Limit | Oba wygrywają | Tylko bazowy | Tylko FIFO | Żaden |
| ---: | ---: | ---: | ---: | ---: |
| 512 | 2 | 7 | 1 | 30 |
| 2048 | 3 | 8 | 0 | 29 |
| 10000 | 1 | 3 | 0 | 6 |

Liczba odkryć tableau, bazowy/FIFO: 554/454 przy512, 546/498 przy2048, 135/125 przy10000. Powroty do identycznej planszy z identyczną wiedzą: 2/0, 0/0, 2/0. Mniejsza liczba ruchów FIFO wynika częściowo z wcześniejszych zatrzymań; nie traktujemy jej jako poprawy. Powrót w środku planu może być celowy, więc sama ta metryka nie dowodzi jałowej pętli.

Łącznie 180 przebiegów, ale tylko 40 różnych kombinacji ziarno/tryb; powtórzenia przy innych budżetach nie są niezależnymi nowymi próbkami. Podzbiór10000 to pierwsze pięć ziaren, nie dobór według wyniku. Nie kalibrowaliśmy wag. Większy budżet zmienia wybór celu i może pogorszyć całą partię: np. FIFO wygrywa203/Draw3 przy512 w120 komendach, lecz zatrzymuje się przy2048 po93 i przy10000 po74.

367 testów jednostkowych oraz build przeszły. Z tego30 testów dotyczą eksperymentu:28 małych pełnotaliowych wariantów porównanych z niezależnym BFS (liczba stanów i rozwinięć, osiągalność celu), konieczny powrót z bazy, permutacje nieznanych kart, kontynuacja i anulowanie. To nie dowodzi optymalności strategii. Nie powtarzaliśmy E2E, pomiarów telefonu ani nowej partii seed42. Dotychczasowe137 ruchów seed42 pochodzi z innego profilu100ms.

## 4. Diagnoza na identycznych pozycjach — nowe pomiary

Przygotowaliśmy pozycje przez replay zapisanej historii i wywołaliśmy oba warianty od DOKŁADNIE tej samej planszy, wiedzy i kontekstu. W tych sondach nie podajemy `previousHint`; mierzymy świeże planowanie. Wyników nie należy mylić z porównaniem dwóch różnych końcowych plansz całych partii.

### A: 203 / Draw1 / 512 stanów, po47 ruchach FIFO

- FIFO: `INCONCLUSIVE/LIMIT_REACHED`,512 rozwinięć,512 zachowanych stanów,0 kandydatów strategicznych i0 informacyjnych,251 nierozwiązanych cięć.
- Bazowy: `FOUND/REVEAL`, legalny plan25 komend, U=93.5,457 rozwinięć,512 zachowanych stanów. Wyszukiwanie ma cięcia, ale znaleziony plan jest poprawny.
- To konkretny przypadek, gdzie przy tym budżecie zmiana kolejności przeszukiwania znajduje cel. FIFO nie odrzuciło go przez próg U: nie dotarło do żadnego kandydata.

### B: 202 / Draw1 / 10000 stanów, po142 ruchach FIFO

- Oba warianty: `INCONCLUSIVE/LIMIT_REACHED`,10000 rozwinięć,10000 zachowanych stanów,0 kandydatów strategicznych i0 informacyjnych.
- Nierozwiązane cięcia: bazowy67377, FIFO66999.
- Bazowy, prowadzony od początku własną historią, wygrał to rozdanie w184 komendach. Nie oznacza to, że potrafi wygrać z obecnej pozycji FIFO. Nie wykonaliśmy pełnego dowodu jej osiągalności ani niewygrywalności.

### C: 203 / Draw3 / 512 stanów, po27 ruchach BAZOWEGO

- Bazowy: `INCONCLUSIVE/LIMIT_REACHED`,512 rozwinięć,512 zachowanych stanów,0 kandydatów strategicznych,76 nierozwiązanych cięć i90 nierozwiniętych stanów.
- FIFO: `FOUND/FOUNDATION_ADVANCE`, legalny plan11 komend, U=31,512 rozwinięć,512 zachowanych stanów. Wynik jest ograniczony, lecz plan zweryfikowany.
- To odwrotny przykład: FIFO znajduje cel pominięty przez obecny porządek. Nie dowodzi wygranej z tej pozycji; pełna niezależna trajektoria FIFO dla tego rozdania wygrała przy512 w120 ruchach.

## 5. O co prosimy

1. Sprawdź kod pod kątem błędu adaptacji lub nieuczciwego budżetowania, zanim przypiszesz porażkę samemu BFS. Wskaż konkretne funkcje i ścieżki wykonania. Czy uwzględnianie granicznych stanów w `maxStates`, nasycenie frontu, deduplikacja przed oceną lub skracanie mogą systematycznie wpływać na porównanie?
2. Wyjaśnij przypadki A i C. Czy warto testować przeplatanie FIFO/Best-First, rezerwację części budżetu na inny porządek albo awaryjne drugie wyszukiwanie po `INCONCLUSIVE`? Nie zakładaj korzyści: określ uczciwy punkt odniesienia dla dodatkowej pracy, np. obecny planer z takim samym większym budżetem.
3. Oddziel problem znalezienia jakiegokolwiek celu od wyboru celu dobrego dla dalszej partii. Przypadek B i zmiany wyników wraz z budżetem wymagają innych dowodów niż przypadek A. Jeśli danych jest za mało, nazwij dokładną dodatkową sondę lub metrykę.
4. Zaproponuj najwyżej dwa małe eksperymenty, po jednej zmianie naraz. Dla każdego podaj hipotezę, dokładny algorytm/pseudokod, zachowane kontrakty, test regresyjny i kryterium odrzucenia na pełnych partiach. Możemy implementować ryzykowne hipotezy w R&D i je odrzucać w Git; potrzebujemy sprawdzalnej propozycji, nie gwarancji wygranej.
5. Nie dodawaj twardego zakazu cofnięć z baz ani powrotów do wcześniejszych pozycji. Nie używaj nieznanych rang/kolorów, nie przekraczaj granicy informacji i nie ogłaszaj braku postępu po ograniczonym wyszukiwaniu. Nie wracaj do wielu arbitralnych wag zmienianych jednocześnie.

Najważniejsza metryka to jakość całych partii i wygrane, potem przyczyny zatrzymań i jałowe powroty. Optymalizacje szybkości zostawiamy na później. Nie uznajemy obecnej heurystyki za nietykalną: jej zmianę trzeba po prostu zbadać oddzielnie i bez utraty poprawności informacyjnej.
