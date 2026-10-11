# Klondike — specyfikacja wykrywania braku osiągalnego postępu

**Status:** propozycja do implementacji
**Zakres:** REQUIREMENTS F04, ARCHITECTURE §6, TEST_PLAN T20
**Poza zakresem:** solver wygrywalności, przewidywanie zakrytych kart, zmiana zasad gry.

## 1. Definicje formalne

### 1.1. Stan gry i legalne akcje

Niech:

- `S` — aktualny stan logiczny gry.
- `L(S)` — kompletny zbiór legalnych akcji zwracanych przez `getLegalMoves(S)`.
- `T(S, a)` — stan po wykonaniu legalnej akcji `a`.
- `S0` — stan początkowy konkretnej analizy.

Stan logiczny obejmuje wszystkie elementy mające wpływ na legalność dalszych akcji: kolejność kart w kolumnach, bazach, stosie dobierania i skrawku, orientację kart oraz tryb Draw 1/3.

Analiza może korzystać wyłącznie z informacji znanych graczowi. Rzeczywiste wartości nieujawnionych kart nie mogą być wykorzystywane do przewidywania dalszych ruchów.

Undo i Redo nie należą do `L(S)`.

### 1.2. Ruch naprzód

**Ruch naprzód** to legalna akcja, która realizuje co najmniej jeden z czterech warunków:

**P1 — Odsłonięcie karty w kolumnie**

W wyniku akcji co najmniej jedna dotychczas zakryta karta kolumny zostaje odkryta.

Liczy się sam fakt odsłonięcia, niezależnie od wartości karty, nawet jeśli po jej odsłonięciu nie pojawią się nowe legalne ruchy.

**P2 — Nowy postęp w bazach**

Po akcji w bazach znajduje się przynajmniej jedna karta, której nie było w bazach w stanie `S0`.

Przykład: zdjęcie 9♣ z bazy, a następnie ponowne umieszczenie jej w tej samej bazie nie jest nowym postępem. Dołożenie 10♣ jest postępem.

Porównujemy tożsamości kart, a nie tylko liczbę kart w bazach.

**P3 — Wyprowadzenie karty ze skrawka**

Karta zostaje legalnie przeniesiona ze skrawka do kolumny.

Jest to postęp, ponieważ karta opuszcza mechanizm dobierania, może udostępnić kolejną kartę skrawka i zmienić dostępność kart przy Draw 3.

Nie jest wymagane natychmiastowe odkrycie karty zakrytej ani dalsze przeniesienie do bazy.

Przeniesienie ze skrawka bezpośrednio do bazy spełnia P2, a także oznacza wyprowadzenie karty ze skrawka.

**P4 — Uzyskanie nowej informacji przez dobieranie**

Akcja `draw` ujawnia graczowi wartość co najmniej jednej karty, której jeszcze nie poznał w danej partii.

Istotne rozróżnienie:

- Pierwsze rzeczywiste ujawnienie nieznanej karty jest postępem informacyjnym.
- Ponowne dobranie znanej karty nie jest postępem.
- Sam `recycle` nie jest postępem.
- Dobranie znanych kart może prowadzić do P2 lub P3 i dlatego wymaga dalszej analizy.

Przy Draw 3 nową informacją są tylko wartości kart rzeczywiście ujawnione graczowi. Nie wolno odczytywać ukrytych wartości wyłącznie ze stanu wewnętrznego silnika.

Postęp informacyjny nie oznacza zwiększenia szans na zwycięstwo. Oznacza zdobycie nowej informacji dostępnej podczas normalnej gry.

### 1.3. Ruch przygotowawczy

**Ruch przygotowawczy** to legalna akcja, która sama nie spełnia P1–P4, ale może umożliwić wykonanie późniejszego ruchu naprzód.

Przykłady:

- Przesunięcie odkrytej karty między kolumnami bez odkrycia kolejnej.
- Przeniesienie króla między pustymi kolumnami.
- Wyjęcie karty z bazy do kolumny.
- Dobranie już znanej karty.
- Recykling skrawka.

Ruch przygotowawczy nie może być uznany za bezużyteczny tylko dlatego, że jego wykonanie nie przynosi natychmiastowego postępu.

### 1.4. Brak osiągalnego ruchu naprzód

Niech `N(S0)` będzie zbiorem wszystkich stanów osiągalnych z `S0` przez zero lub więcej legalnych akcji, które nie spełniają P1–P4.

**Postęp jest osiągalny**, gdy istnieje stan `S` należący do `N(S0)` oraz legalna akcja `a`, która spełnia co najmniej jeden z warunków P1–P4 względem `S0`.

**Brak osiągalnego postępu** zachodzi wtedy i tylko wtedy, gdy przeszukiwanie wszystkich takich stanów zostało zakończone i nie znaleziono żadnej akcji spełniającej P1–P4.

Przeszukiwanie może obejmować dowolnie długą, ale skończoną sekwencję legalnych ruchów przygotowawczych. Nie istnieje ograniczenie do jednego lub dwóch przełożeń.

Definicja obejmuje także sekwencje wymagające tymczasowego pogorszenia układu, np. zdjęcia karty z bazy.

## 2. Trzy różne sytuacje

| Sytuacja | Znaczenie | Warunek rozpoznania |
|---|---|---|
| Brak legalnych akcji | Nie da się wykonać żadnego ruchu w aktualnym stanie | `L(S0)` jest puste |
| Brak osiągalnego postępu | Legalne ruchy mogą istnieć, ale wszystkie osiągalne sekwencje przygotowawcze są jałowe | Całkowicie zakończone przeszukiwanie bez P1–P4 |
| Brak możliwości wygrania | Nie istnieje żadna legalna sekwencja prowadząca do ukończenia wszystkich baz | Osobny dowód dotyczący osiągalności zwycięstwa |

Nie należy utożsamiać tych pojęć.

W szczególności analiza F04:

- Nie jest pełnym solverem.
- Nie ocenia prawdopodobieństwa zwycięstwa.
- Nie ocenia, czy początkowe rozdanie było wygrywalne.
- Nie uwzględnia Undo jako drogi kontynuacji.
- Nie informuje o przegranej.

**Uwaga logiczna:** w pełni znanym stanie, przy kompletnym przeszukaniu i przy założeniu, że zwycięstwo wymaga P1–P4, stwierdzenie braku dalszego postępu wyklucza zwycięstwo bez cofnięcia wcześniejszych decyzji. Nie oznacza to jednak, że całe rozdanie było niewygrywalne. Interfejs nie powinien przedstawiać takiego wniosku jako dowodu przegranej partii.

## 3. Klasyfikacja akcji

| Akcja | Klasyfikacja | Szczegóły |
|---|---|---|
| Tableau → Foundation | Postęp warunkowy | P2, jeśli baza uzyskuje kartę nieobecną w niej w `S0` |
| Waste → Foundation | Postęp | P2 lub P3 |
| Waste → Tableau | Postęp | P3, nawet bez odkrycia zakrytej karty |
| Tableau → Tableau, odkrywa kartę | Postęp | P1 |
| Tableau → Tableau, bez odkrycia | Przygotowanie | Wymaga przeszukania dalszych stanów |
| Foundation → Tableau | Przygotowanie | Samo zmniejszenie bazy nie jest postępem |
| Draw nieznanej karty | Postęp informacyjny | P4 |
| Draw wyłącznie znanych kart | Przygotowanie | Kontynuować analizę |
| Recycle | Przygotowanie | Kontynuować analizę; możliwy cykl |
| Undo / Redo | Poza analizą | Operacje historii, nie legalne akcje gry |

Jeśli jedna akcja spełnia kilka warunków, wystarcza jeden do potwierdzenia osiągalnego postępu.

### 3.1. Szczególna zasada dotycząca baz

Przeszukiwanie nie może zakładać, że karty umieszczone w bazach nigdy ich nie opuszczą.

Przykład:

1. Na bazie znajduje się 9♣.
2. Można przenieść 9♣ na 10♥ w kolumnie.
3. Następnie można przenieść 8♥ z innej kolumny na 9♣.
4. Ten drugi ruch odkrywa zakrytą kartę.

W takim stanie istnieje osiągalny postęp, mimo że pierwszy ruch zmniejsza liczbę kart w bazach.

Jednocześnie cykl 9♣: baza → kolumna → baza nie może być uznany za nowy postęp.

### 3.2. Szczególna zasada dotycząca skrawka

Nie wolno wymagać, aby karta przeniesiona ze skrawka od razu trafiła do bazy lub odsłoniła kartę zakrytą.

Samo wyprowadzenie karty ze skrawka jest zmianą strukturalną istotną dla dalszej gry.

Natomiast samo przesuwanie kart między stock i waste nie jest automatycznie postępem. Dla znanych kart należy sprawdzić, czy prowadzi do P1, P2 albo P3.

## 4. Wyniki analizy i komunikaty

Analiza powinna zwracać jeden z trzech wyników:

| Wynik | Znaczenie | Zachowanie UI |
|---|---|---|
| `PROGRESS_FOUND` | Znaleziono legalną drogę do P1–P4 | Nie pokazywać komunikatu o braku postępu |
| `NO_PROGRESS` | Wyczerpano wszystkie osiągalne stany przygotowawcze; nie istnieje P1–P4 | Pokazać komunikat |
| `UNKNOWN` | Analiza nie została zakończona lub brak wystarczających informacji | Nie pokazywać komunikatu o braku postępu |

Brak legalnych akcji może być ustalany oddzielnie przez `getLegalMoves` i raportowany jako `NO_LEGAL_MOVES`.

Stan `WON` ma pierwszeństwo przed analizą braku ruchów.

### Zalecane komunikaty

**Gdy `NO_PROGRESS`:**

> Brak ruchów prowadzących do dalszego postępu.

**Gdy `NO_LEGAL_MOVES`:**

> Brak dostępnych ruchów.

Przy `UNKNOWN` nie wyświetlać żadnego komunikatu sugerującego brak postępu. Jeżeli użytkownik wyraźnie zażąda podpowiedzi, można pokazać neutralną informację: „Nie udało się ocenić dalszych ruchów”.

Nie używać sformułowań „Przegrałeś”, „Partia niewygrywalna” ani „Nie ma możliwości wygrania”.

## 5. Przeszukiwanie, cykle i zakończenie

### 5.1. Zasada przeszukiwania

1. Zacząć od aktualnego stanu `S0`.
2. Sprawdzić legalne akcje.
3. Jeżeli akcja realizuje P1–P4, zakończyć wynikiem `PROGRESS_FOUND`.
4. W przeciwnym razie rozważyć jej stan wynikowy jako kolejny stan przygotowawczy.
5. Kontynuować po wszystkich legalnych akcjach przygotowawczych.
6. Powtórnie napotkany równoważny stan pominąć.
7. Jeśli nie pozostały żadne niezbadane stany i nie znaleziono postępu, zwrócić `NO_PROGRESS`.

Każda gałąź, która odsłania nową, wcześniej nieznaną kartę, kończy się potwierdzeniem postępu informacyjnego. Nie wolno symulować dalszych ruchów na podstawie jej ukrytej wartości.

### 5.2. Identyfikacja równoważnych stanów

Klucz stanu musi rozróżniać co najmniej:

- Karty i ich kolejność w siedmiu kolumnach.
- Orientację kart.
- Zawartość i kolejność czterech baz.
- Kolejność kart w stock.
- Kolejność kart w waste.
- Tryb Draw 1 lub Draw 3.
- Stan wiedzy o kartach ujawnionych wcześniej.
- Wszystkie ograniczenia reguł, które wpływają na przyszłą legalność akcji.

Dla aktualnie zakrytych, niepoznanych kart nie wolno wykorzystywać rzeczywistych rang i kolorów do planowania. Można posługiwać się ich anonimowymi pozycjami.

Z klucza można pominąć licznik czasu, punktację, historię Undo/Redo, zaznaczenie karty, animacje oraz inne dane bez wpływu na przyszłe akcje.

Klucz nie może utożsamiać różnych kolejności skrawka i stosu dobierania. Ma to szczególne znaczenie w Draw 3.

### 5.3. Cykle

Powrót do stanu równoważnego z odwiedzonym wcześniej nie tworzy nowej możliwości dalszego postępu.

Dotyczy to również:

- Przekładania króla między pustymi kolumnami.
- Odkładania karty do bazy po wcześniejszym jej wyjęciu.
- Powtarzania draw/recycle bez zmian w dostępności kart.

Samo wykrycie jednego cyklu nie wystarcza do `NO_PROGRESS`. Można zwrócić ten wynik dopiero po wyczerpaniu wszystkich gałęzi, również wychodzących z innych odwiedzonych stanów.

### 5.4. Bezpieczeństwo wydajnościowe

Zalecane początkowe limity implementacyjne:

- Maksymalnie 10 000 różnych analizowanych stanów.
- Budżet około 100 ms na pojedynczą analizę.
- Praca w małych partiach, bez długiego blokowania interfejsu mobilnego.

Są to proponowane wartości do pomiaru i dostrojenia, a nie matematyczne ograniczenia przeszukiwania.

Obowiązują reguły:

- Limit osiągnięty przy niepustym zbiorze stanów oczekujących: `UNKNOWN`.
- Wszystkie stany wyczerpane: `NO_PROGRESS`.
- Znaleziony postęp: `PROGRESS_FOUND`.
- Nigdy nie wyciągać negatywnego wniosku z samej liczby przeszukanych stanów.

Limit czasu nie powinien być wykorzystywany w testach jako jedyny deterministyczny mechanizm wymuszający `UNKNOWN`; testy powinny móc stosować kontrolowany limit liczby stanów.

## 6. Undo, Redo i informacje zakryte

### Undo i Redo

Undo i Redo nie są krawędziami grafu analizy.

Po rzeczywistym Undo/Redo należy ocenić nowy aktualny stan, a nie kontynuować wynik analizy starej planszy.

Ruch może być postępem, mimo że Undo pozwala go cofnąć.

Nie wolno uznawać za brak postępu samego faktu, że po wykonaniu ruchu użytkownik może wrócić do wcześniejszego układu.

Jeżeli po Undo ponownie możliwe jest odkrycie karty, jest to osiągalny postęp bieżącej pozycji, nawet gdy karta była kiedyś już odkryta w cofniętej historii.

### Wiedza o kartach

Należy oddzielić:

- Faktyczny układ kart, znany silnikowi.
- Informacje ujawnione graczowi podczas rozgrywki.
- Informacje aktualnie widoczne na planszy.

W celu rozpoznawania nowych informacji z dobierania analiza może utrzymywać zbiór identyfikatorów kart, których wartości zostały rzeczywiście ujawnione graczowi. Taka wiedza nie musi znikać po Undo, ponieważ gracz mógł zapamiętać kartę.

Nie uprawnia to do wykorzystywania aktualnie zakrytych kart do ukrytego optymalizowania podpowiedzi.

**Wymóg bezwzględny:** ranking podpowiedzi nie może zależeć od rzeczywistych wartości kart zakrytych.

Jeśli system nie ma wiarygodnych danych o tym, czy karta ze stock była wcześniej poznana, musi traktować ją jako niepoznaną i nie może na tej podstawie dowodzić `NO_PROGRESS`.

Stan wiedzy powinien być zachowywany wraz z zapisem partii, o ile aplikacja obsługuje przywracanie sesji.

## 7. Fixture’y — konkretne stany testowe

### 7.1. Wspólna konwencja

Aby opisy były kompletne i nie wymagały wypisywania 52 kart w każdym przypadku:

- `F6` oznacza cztery bazy zawierające w każdym kolorze A–6, łącznie 24 karty.
- `F7` oznacza cztery bazy zawierające A–7, łącznie 28 kart.
- `H(n)` oznacza dokładnie `n` zakrytych kart u dołu kolumny.
- Karty po `H(n)` są odkryte, zapisane od dołu do góry.
- `W` to waste, ostatni element jest wierzchnią kartą.
- Brak podanego `stock` lub `waste` oznacza pusty stos.

**Reguła kompletowania fixture’ów:** wszystkie niewypisane karty rozdania należy rozmieścić dokładnie raz na pozycjach `H(n)`, według stałego porządku: ranga A–K, a następnie kolor ♣, ♦, ♥, ♠. Miejsca zakryte należy wypełniać kolumnami C1–C7, od dołu ku górze.

Każdy fixture musi zachowywać pełną talię 52 unikalnych kart, poprawne prefiksy baz oraz legalne sekwencje odkryte. Nie wolno uzupełniać fixture’a dodatkowymi kartami spoza talii.

### FX01 — Brak jakichkolwiek legalnych akcji

Bazy: `F6`

| Kolumna | Zawartość |
|---|---|
| C1 | 8♠ |
| C2 | H(1), 8♥ |
| C3 | H(2), 8♦ |
| C4 | H(3), 8♣ |
| C5 | H(4), J♠ |
| C6 | H(5), J♥ |
| C7 | H(6), J♣ |

Stock i waste puste.

Brakuje dostępnych siódemek do baz; żadne widoczne karty nie pozwalają na przełożenie. Nie ma pustej kolumny ani dostępnego dobierania.

Oczekiwane:

- `getLegalMoves = []`.
- Rozpoznanie `NO_LEGAL_MOVES`.
- Wynik analizy postępu: `NO_PROGRESS`.
- UI: „Brak dostępnych ruchów”.

### FX02 — Legalne, ale jałowe przekładanie

Bazy: `F6`

| Kolumna | Zawartość |
|---|---|
| C1 | K♠ |
| C2 | pusta |
| C3 | H(2), 8♠ |
| C4 | H(3), 8♥ |
| C5 | H(4), 8♦ |
| C6 | H(5), J♠ |
| C7 | H(6), Q♣, J♥, 10♣ |

Stock i waste puste.

Król może przechodzić między C1 i C2. Nie powstaje przy tym możliwość odkrycia karty ani rozbudowania baz.

Oczekiwane:

- `getLegalMoves` nie jest puste.
- Ruch K♠ C1→C2 jest legalny.
- Odwrotny ruch przywraca wcześniejszą pozycję.
- Pełne przeszukanie kończy się `NO_PROGRESS`.
- UI: „Brak ruchów prowadzących do dalszego postępu”.

### FX03 — Ruch przygotowawczy prowadzący do postępu

Bazy: ♣ A–9, pozostałe trzy bazy A–6.

| Kolumna | Zawartość |
|---|---|
| C1 | K♥ |
| C2 | H(1), 8♥ |
| C3 | H(2), 10♥ |
| C4 | H(3), 8♦ |
| C5 | H(4), J♥ |
| C6 | H(4), 8♠ |
| C7 | H(4), Q♥ |

Stock i waste puste.

Istnieje droga:

1. Foundation 9♣ → C3, na 10♥.
2. C2 8♥ → C3, na 9♣.
3. Następuje odkrycie zakrytej karty C2.

Oczekiwane:

- Pierwszy ruch nie jest postępem.
- Drugi ruch jest postępem P1.
- `PROGRESS_FOUND`.
- Brak komunikatu o braku postępu.

Nie wolno odrzucić pierwszego ruchu tylko dlatego, że zmniejsza bazę.

### FX04 — Bezpośredni ruch do bazy

Fixture FX01, z jedną zmianą: odkryte 8♠ w C1 zamienione miejscami z zakrytą 7♠.

Oczekiwane:

- Dostępne C1 7♠ → baza ♠.
- P2 spełnione w jednym ruchu.
- `PROGRESS_FOUND`.
- Brak ostrzeżenia.

### FX05 — Wyprowadzenie karty ze skrawka

Bazy: `F6`.

Fixture FX01 z następującymi zmianami:

- C1: 10♥ zamiast 8♠.
- C7: `H(4), J♣` zamiast `H(6), J♣`.
- Waste: `[7♣, 9♣]`, gdzie 9♣ jest na wierzchu.
- Pozostałe zakryte karty uzupełnione zgodnie z regułą wspólną.

Oczekiwane:

- W9♣ → C1, na 10♥, jest legalne.
- Akcja spełnia P3.
- W7♣ staje się kartą wierzchnią i można ją przenieść do bazy.
- `PROGRESS_FOUND` już dla pierwszej akcji.
- Brak ostrzeżenia.

### FX06 — Dobranie nowej informacji

Fixture FX01, ale karta Q♦ została wyjęta z części zakrytej i umieszczona jako jedyna karta w stock. Pozostałe pozycje zakryte uzupełnione według reguły wspólnej.

Karta Q♦ nie została wcześniej ujawniona graczowi.

Oczekiwane:

- `draw` jest legalne.
- Analiza rozpoznaje możliwość uzyskania nowej informacji P4.
- `PROGRESS_FOUND`.
- Nie wolno wykorzystać faktu, że ukrytą kartą jest Q♦, do oceny jej przyszłych ruchów.
- Permutacja niepoznanych kart nie zmienia wyniku analizy przed dobieraniem.

### FX07 — Powtarzanie stock/waste bez postępu

Taki sam układ kart jak FX06, lecz wartość karty w stock została już rzeczywiście poznana w poprzednim obiegu.

Przyjmujemy, że poznaną kartą jest Q♦.

Oczekiwane:

- `draw` jest legalne.
- Po dobraniu karta Q♦ nie ma dostępnego ruchu do bazy lub kolumny.
- Można wykonać `recycle` i kolejny `draw`.
- Te operacje wracają do równoważnych stanów.
- `NO_PROGRESS` po zakończeniu przeszukiwania.
- Identyczne zachowanie dla Draw 1 i Draw 3 w tym jednokartowym przykładzie.

Wariant: zacząć ze stock pustym i waste zawierającym Q♦. `recycle` nadal jest legalne, lecz nie stanowi postępu.

### FX08 — Przekroczenie budżetu analizy

Użyć FX02 z limitem pozwalającym przeanalizować wyłącznie stan początkowy, ale nie jego neutralnego następnika.

Oczekiwane:

- Pozostają niezbadane osiągalne stany.
- `UNKNOWN`, a nie `NO_PROGRESS`.
- UI nie pokazuje ostrzeżenia.
- Po usunięciu ograniczenia analiza FX02 kończy się `NO_PROGRESS`.

### FX09 — Przywrócenie karty do tej samej bazy

Użyć FX03.

Wykonać Foundation 9♣ → Tableau, a następnie Tableau 9♣ → Foundation bez innych zmian.

Oczekiwane:

- Obie akcje legalne.
- Powrót 9♣ na pierwotną bazę nie jest P2.
- Powstały cykl nie jest dowodem nowego postępu.
- Przeszukiwanie nadal znajduje alternatywną sekwencję z FX03 prowadzącą do P1.
- Ostatecznie `PROGRESS_FOUND`.

### FX10 — Stan zwycięstwa

Wszystkie 52 karty w bazach. Kolumny, stock i waste puste.

Oczekiwane:

- Stan gry `WON`.
- Nie pokazywać żadnego komunikatu o braku ruchów ani braku postępu.
- Analiza postępu może zostać pominięta.

## 8. TEST_PLAN T20 — testy jednostkowe i E2E

### 8.1. Testy jednostkowe

| ID | Test | Oczekiwanie |
|---|---|---|
| UT01 | FX01, brak legalnych akcji | `NO_LEGAL_MOVES`, `NO_PROGRESS` |
| UT02 | FX02, cykl K♠ | `NO_PROGRESS` |
| UT03 | FX03, wyjęcie 9♣ z bazy | `PROGRESS_FOUND` |
| UT04 | FX04, bezpośrednia baza | `PROGRESS_FOUND` |
| UT05 | FX05, waste→tableau | `PROGRESS_FOUND` |
| UT06 | FX06, nowa karta ze stock | `PROGRESS_FOUND` |
| UT07 | FX07, powtarzane draw/recycle | `NO_PROGRESS` |
| UT08 | FX08, wyczerpany budżet | `UNKNOWN` |
| UT09 | FX09, powrót do bazy | Brak fałszywego P2 |
| UT10 | FX10, wygrana | `WON` |
| UT11 | Draw 3 z jedną/dwiema kartami stock | Zgodność z regułami dobierania; bez fałszywego postępu |
| UT12 | Draw 3, zmiana grupowania po wyprowadzeniu waste | Nowa kolejność uwzględniona w analizie |
| UT13 | Dwa stany z różną kolejnością waste | Nie mogą być błędnie utożsamione |
| UT14 | Sekwencja przygotowawcza o długości większej niż 2 | Postęp odnaleziony bez limitu głębokości |
| UT15 | Permutacja nieujawnionych kart tableau | Taki sam wynik przed odkryciem |
| UT16 | Permutacja niepoznanych kart stock | Taka sama ocena i ranking podpowiedzi przed ujawnieniem |
| UT17 | Undo ruchu odkrywającego kartę | Ponowna analiza przywróconego układu |
| UT18 | Redo ruchu odkrywającego kartę | Analiza nowego układu, bez starego cache |
| UT19 | Brak mutacji stanu przy analizie | Stan gry identyczny przed i po |
| UT20 | Wszystkie neutralne ścieżki wyczerpane | `NO_PROGRESS` tylko przy pustej kolejce przeszukiwania |
| UT21 | Przekroczenie limitu w obecności nieodkrytej gałęzi | `UNKNOWN` |
| UT22 | Dwukrotna analiza tego samego stanu i wiedzy | Ten sam wynik przy tym samym budżecie stanów |
| UT23 | Różne warianty dojścia do tego samego układu | Stan oceniany tylko raz |
| UT24 | Nieznany status wcześniejszego poznania stock | Brak negatywnego wniosku wymagającego nieudokumentowanej wiedzy |

Testy powinny obejmować oba tryby Draw 1 i Draw 3 tam, gdzie reguła dobierania ma znaczenie.

Każdy fixture powinien dodatkowo przejść walidację integralności talii, liczby kart, kolejności baz i legalności odkrytych sekwencji.

### 8.2. Testy E2E

| ID | Scenariusz | Oczekiwane zachowanie |
|---|---|---|
| E2E01 | Wczytanie FX01 | „Brak dostępnych ruchów” |
| E2E02 | Wczytanie FX02 | Komunikat o braku postępu mimo możliwości przenoszenia króla |
| E2E03 | Wczytanie FX03 | Brak ostrzeżenia; możliwa sekwencja przygotowawcza |
| E2E04 | Wczytanie FX04 | Dostępna podpowiedź do bazy |
| E2E05 | Wczytanie FX05 | Przeniesienie karty waste do tableau bez fałszywego ostrzeżenia |
| E2E06 | Wczytanie FX06 | Dostępne dobranie niepoznanej karty |
| E2E07 | Wczytanie FX07 | Cykliczne dobieranie nie usuwa prawdziwego stanu braku postępu |
| E2E08 | Wymuszone `UNKNOWN` | Nie pojawia się komunikat o braku postępu |
| E2E09 | Undo/Redo po odsłonięciu karty | Komunikat odpowiada aktualnemu stanowi |
| E2E10 | Zmiana stanu podczas trwającej analizy | Stary wynik jest ignorowany |
| E2E11 | Przywrócenie zapisanej sesji | Poprawna analiza odtworzonego stanu i zapisanej wiedzy |
| E2E12 | Draw 3 i wielokrotny recycle | Brak zawieszenia, fałszywego postępu i fałszywego ostrzeżenia |
| E2E13 | FX10, ukończona gra | Komunikat zwycięstwa ma pierwszeństwo |

E2E powinny ładować deterministyczne stany testowe, a nie wymagać ręcznego rozegrania kilkudziesięciu ruchów.

## 9. Gotowe zmiany do dokumentów projektu

### REQUIREMENTS — F04

**F04 — Wykrywanie braku osiągalnego postępu**

Aplikacja musi rozróżniać brak legalnych akcji od braku osiągalnego ruchu naprzód.

Za postęp uznaje się:

- Odkrycie karty zakrytej w tableau.
- Umieszczenie w bazie karty, której nie było w bazach na początku analizy.
- Przeniesienie karty ze skrawka do tableau lub bazy.
- Rzeczywiste ujawnienie wcześniej niepoznanej wartości karty przez dobieranie.

Samo dobranie znanej karty, wykonanie recyklingu, jałowe przełożenie między kolumnami oraz wyjęcie karty z bazy nie są automatycznie postępem.

System musi sprawdzać, czy legalna sekwencja ruchów przygotowawczych umożliwia postęp.

System musi uwzględniać wszystkie legalne rodzaje ruchów, w tym powrót z bazy do tableau.

System nie może uznać pojedynczego cyklu za dowód braku postępu bez zbadania pozostałych gałęzi.

Wynik analizy musi rozróżniać znaleziony postęp, udowodniony brak postępu oraz wynik nierozstrzygnięty.

Komunikat o braku postępu wolno wyświetlić wyłącznie po kompletnym zakończeniu przeszukiwania.

Wynik nierozstrzygnięty nie może powodować komunikatu o braku postępu.

Analiza nie może wykorzystywać nieujawnionych wartości kart do przewidywania ruchów. Ranking podpowiedzi nie może zależeć od ukrytych wartości kart.

Undo i Redo pozostają operacjami historii poza grafem legalnych działań gry.

System nie może utożsamiać braku osiągalnego postępu z dowodem niewygrywalności całego rozdania.

### ARCHITECTURE — §6

**§6 — Legalne akcje, analiza postępu i podpowiedzi**

Silnik pozostaje deterministyczny i niemutujący.

`getLegalMoves`, `isLegalMove` oraz `applyMove` pozostają źródłem prawdy o legalności i wykonywaniu akcji.

Analiza osiągalnego postępu jest osobną warstwą korzystającą z istniejącego silnika. Nie należy implementować drugiego zestawu reguł legalności.

Analiza wykonuje przeszukiwanie grafu stanów osiągalnych przez legalne ruchy przygotowawcze.

Stan odwiedzony jest identyfikowany przez kanoniczny klucz uwzględniający wszystkie elementy wpływające na przyszłą legalność ruchów. Klucz wyklucza historię Undo/Redo i dane prezentacyjne.

Warunki postępu są oceniane względem stanu początkowego analizy, w szczególności przy zmianach zawartości baz.

Stany zawierające nieujawnione karty analizuje się bez korzystania z ich rzeczywistych wartości. Osiągnięcie granicy nowej informacji kończy daną ścieżkę pozytywnym wynikiem informacyjnym.

Wynik analizy przyjmuje wartości:

- `PROGRESS_FOUND`
- `NO_PROGRESS`
- `UNKNOWN`

`NO_PROGRESS` może zostać zwrócone wyłącznie po wyczerpaniu wszystkich osiągalnych stanów przygotowawczych.

Przekroczenie budżetu obliczeniowego przy istnieniu niezbadanych stanów daje `UNKNOWN`.

Analiza jest ograniczona zasobowo, może być anulowana i nie może blokować interfejsu na długi czas.

Wynik obliczony dla nieaktualnego stanu nie może być zastosowany do nowego stanu planszy.

Podpowiedzi i klasyfikacja postępu mogą współdzielić logikę oceny legalnych akcji, ale ranking podpowiedzi nie może wykorzystywać tajnych informacji ze stanu talii.

Analiza nie zmienia stanu gry, historii, liczników ani zapisu sesji.

### TEST_PLAN — T20

**T20 — Weryfikacja wykrywania braku osiągalnego postępu**

Celem T20 jest potwierdzenie, że system:

1. Odróżnia brak legalnych akcji od braku osiągalnego postępu.
2. Wykrywa jałowe, odwracalne przekładanie kart.
3. Znajduje postęp wymagający wielu przygotowawczych ruchów.
4. Uwzględnia korzystne tymczasowe wyjmowanie kart z baz.
5. Rozpoznaje przenoszenie waste→tableau jako postęp.
6. Odróżnia nową informację przy dobieraniu od powtarzania już znanego cyklu stock/waste.
7. Poprawnie obsługuje Draw 1 i Draw 3.
8. Nie wykorzystuje niepoznanych wartości kart.
9. Nie utożsamia jednego wykrytego cyklu z wyczerpaniem przestrzeni stanów.
10. Nigdy nie zwraca `NO_PROGRESS` po przekroczeniu budżetu, gdy pozostają niezbadane stany.
11. Poprawnie reanalizuje stan po Undo, Redo i przywróceniu sesji.
12. Nie przedstawia wyniku jako dowodu przegranej ani niewygrywalności całej partii.

Wymagane są fixture’y FX01–FX10 oraz testy jednostkowe UT01–UT24 i E2E01–E2E13 z niniejszej specyfikacji.

**Kryterium odbioru T20:** wszystkie testy przechodzą, w szczególności nie istnieje przypadek, w którym interfejs ogłasza brak osiągalnego postępu na podstawie analizy zakończonej limitem zasobów lub wykorzystującej niepoznane wartości kart.

## 10. Decyzje implementacyjne i granice zakresu

Specyfikacja nie wymaga:

- Pełnego solvera Klondike.
- Szacowania prawdopodobieństwa wygranej.
- Analizowania różnych możliwych wartości zakrytych kart.
- Uczenia maszynowego.
- Oceny optymalności ruchów.
- Zmian w zasadach dobierania, recyklingu czy baz.

Wymaga natomiast konsekwentnego rozdzielenia legalności, postępu, wiedzy o kartach i wyczerpania przestrzeni stanów.

**Warunek końcowy:** system może powiedzieć, że nie ma drogi do dalszego postępu w przyjętym znaczeniu, tylko gdy faktycznie sprawdził wszystkie osiągalne drogi przygotowawcze. Jeżeli nie sprawdził wszystkich, musi pozostawić wynik nierozstrzygnięty.
