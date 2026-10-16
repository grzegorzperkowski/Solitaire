# Smart Hint — wyniki X1/X2 dla kolejnej diagnozy

Wykonaliśmy oba zaproponowane eksperymenty. X1 dał konkretnych świadków ograniczeń zasięgu, a X2 nie przeszedł niezależnej walidacji. Produkcyjny Best-First pozostał bez zmian. Nie zmienialiśmy kolejki, limitu głębokości, U, progów, wiedzy ani historii.

## X2: B przed długością i Expected w REVEAL

Źródło bazowe: commit `2d1ecfc`. Jedyna zmiana strategiczna: `H → L → Expected → B → U` zamienione na `H → B → L → Expected → U`. Pozostałe reguły i priorytet wygranej zachowane. Wszystkie partie: Best-First4096, maxDepth32, maksymalnie500 komend, deterministyczny budżet stanów, normalne commitment i chronologiczna wiedza. Wykonywaliśmy wyłącznie pierwszą komendę podpowiedzi, potem następne żądanie.

| Zbiór | Kontrola | X2 | Zysk/strata wygranych |
| --- | --- | --- | --- |
| Eksploracyjny: seeds200–219, oba tryby,40 par | 11 | 13 | +2/−0 |
| Walidacyjny: seeds220–259, oba tryby,80 par | 37 | 35 | +1/−3 |

Walidacja była ustalona przed uruchomieniem i została ukończona w całości, bez strojenia. Draw1:25→24 wygrane; Draw3:12→11.34 wspólne wygrane,42 wspólne zatrzymania.

Regresje:220/Draw1 WON140→INCONCLUSIVE119;224/Draw3 WON121→INCONCLUSIVE69;235/Draw3 WON112→INCONCLUSIVE76. Zysk:251/Draw3 INCONCLUSIVE103→WON146.

Walidacyjna różnica wygranych:−2,5 pp. Opisowy95% seed-cluster bootstrap: [−7,5;+2,5] pp;20000 replik, seed20261016, oba tryby danego seeda resamplowane razem. Mała próba nie dowodzi populacyjnego pogorszenia, ale nie daje wymaganej poprawy do wdrożenia. X2 odrzucamy jako zmianę produkcyjną.

Oba eksploracyjne zyski pochodziły z seeda211: Draw1 INCONCLUSIVE98→WON154, Draw3 INCONCLUSIVE79→WON129. Zrobiliśmy kontrolę jednej decyzji: od identycznego prefiksu wykonaliśmy dokładnie jeden alternatywny zaakceptowany plan X2, następnie wróciliśmy do niezmienionego Best-First4096. Obie partie nadal wygrały i dokładnie odtworzyły trajektorie X2. W tych korzeniach niższe B pomagało:

- Draw1, po48 komendach: H1/B1/L1 kontra H1/B0/L21.
- Draw3, po52 komendach: H1/B1/L1 kontra H1/B0/L20.

Jednak to nie jest reguła uniwersalna. W220/Draw1 po101 komendach kontrola wybiera H1/B1/L5, X2 H1/B0/L6. Pierwsze3 komendy są identyczne; rozjazd następuje podczas commitment. Po107 X2 wybiera kolejne H1/B0/L4 zamiast H1/B1/L2. Nie izolowaliśmy jeszcze wpływu tych dwóch decyzji. Ważne: brak zmiany pierwszej komendy przy świeżym wyborze nie oznacza braku wpływu na całą partię.

Izolację eksperymentu sprawdziliśmy: przy każdym zmienionym zwycięzcy uruchamiano drugi komparator na tym samym korzeniu i sprawdzano dokładną zgodność strumienia kwalifikowanych kandydatów oraz liczników grafu. Dwa rzeczywiste korzenie sprawdzono dodatkowo przez pełne ślady ekspansji/generowania/oceny. Wszystko zgodne. Końcowe skracanie wybranych planów może się różnić i nie jest częścią porównywanego grafu.

Eksploracja: kontrola1319 świeżych analiz,11 zmian pełnego planu/9 pierwszej komendy; trajektorie X2:1325/15/13. Walidacja: kontrola2828/11/10, X2 2823/16/15. To metryki dwóch różnych zbiorów korzeni, nie niezależne obserwacje do sumowania. Wszystkie zmiany zachowywały H. Na walidacji oba warianty miały0 powtórzeń plansza+wiedza; na zbiorze eksploracyjnym po2. Powrót nie musi być jałowym cyklem.

## X1: gdzie przestaje wystarczać Best-First10000?

Odtworzyliśmy FIFO seed202/Draw1,142 komendy. Zbadaliśmy wszystkie17 granic ukończonych planów od52 do142 i dodatkowo wszystkie13 komend wewnątrz pierwszego przedziału wygrana→zatrzymanie89–103. Łącznie30 przełączeń, bez binary search. Wiedza i aktywne snapshots odtwarzane chronologicznie. Przy pierwszym żądaniu po przełączeniu brak dawnego commitment; dalej normalna kontynuacja planów. Limit całej partii500, depth32.

- Przełączenie po52: WON184; po72–86: WON165; po89/90: WON164; po91/92: WON166.
- Po93–103: INCONCLUSIVE; wszystkie późniejsze badane granice także INCONCLUSIVE.
- Od korzenia89: wykonanie pełnego14-komendowego planu FIFO, następnie Best-First10000 daje INCONCLUSIVE140. Natychmiastowy Best-First10000 daje WON164.

Dokładny audyt korzenia89: FIFO wybiera REVEAL/H1/B0/L14; Best-First REVEAL/H1/B0/L21, F9. X2 wybiera ten sam plan co Best-First. Best-First nie znalazł końca planu FIFO w swoich5876 kwalifikowanych kandydatach; FIFO nie znalazł końca zwycięskiego planu Best-First w swoich1438. Nie mamy tu wspólnego zbioru celów, między którymi wystarczyłoby poprawić komparator B.

Najważniejszy nowy świadek:92→93 to recycle bez nowej wiedzy.16 znanych draw odtwarza dokładnie całą planszę i wiedzę z92. Następnie legalny replay zapisanej zwycięskiej kontynuacji wygrywa:90 komend od93,183 łącznie. To retrospektywny świadek odzyskania pozycji93, nie nowa polityka i nie użycie ukrytych kart do wyboru podpowiedzi.

Pierwszy REVEAL na tej drodze wymaga33 komend. Nie można jednak sprowadzić problemu tylko do depth32: zaakceptowane FOUNDATION_ADVANCE przekraczające maksimum historii występują już na17 komendach. Best-First10000 z93 nie znalazł końców tych konkretnych planów. Znalazł inny REVEAL i zatrzymał się dopiero później. Mamy zatem konkretną lukę zasięgu względem legalnych alternatyw, nie dowód braku wszystkich celów w93.

Końcowy B142 nadal ma klasyfikację SEARCH_COVERAGE_UNKNOWN. Świadek z93 niczego nie dowodzi o142. Przełączenia wewnątrz planu unieważniają commitment; odróżniamy je od przełączeń na ukończonych granicach.

## Kod i dowody do dołączenia

- `.project/reports/T028-x1-x2-rd.md`: pełny raport, dokładne polecenia i ograniczenia.
- `scripts/experiments/smart-hint-selection.mjs`: materializacja dokładnego źródła2d1ecfc, izolowana podmiana komparatora, obserwacja i benchmark.
- `.project/reports/T028-selection-validation-summary.json` oraz `T028-selection-4096-summary.json`: wszystkie wyniki, zmienione plany, sparowanie, metryki i SHA surowych danych.
- `.project/reports/T028-prefix-switch-summary.json`:30 korzeni, wiedza i wyniki przełączeń.
- `.project/reports/T028-prefix-recovery.json`: pełny90-komendowy świadek i osiągalne cele od17 komend.
- `.project/reports/T028-selection-graph-probes.json`: identyczność grafu i porównanie FIFO/Best-First z89.
- `.project/reports/T028-selection-counterfactual.json`: kontrola jednej decyzji dla211.

379 testów jednostkowych i build przeszły; replay/assertions diagnostyczne również. E2E nie powtarzano, aplikacja nie zmieniona. Dodatkowy seed202 przy10000: Draw1 oba wygrywają184→181 komend; Draw3 oba NO_STRATEGIC_PROGRESS37. Nie uznajemy trzech zaoszczędzonych komend za poprawę wygrywalności.

Prosimy teraz o diagnozę dobrych i złych przypadków oraz propozycję kolejnego izolowanego eksperymentu. Potrzebujemy hipotezy, konkretnej zmiany implementacyjnej, kontroli i kryterium odrzucenia. Priorytetem jest prowadzenie całych partii, zachowanie potrzebnych cofnięć z baz i przygotowań, brak jałowych oscylacji oraz brak podglądania nieznanych kart. Szybkość jest drugorzędna. Nie oczekujemy gwarancji wygrania każdego rozwiązywalnego rozdania.
