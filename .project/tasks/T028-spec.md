# SmartHint — specyfikacja T028

Status: repair revision delivered 2026-10-14, REVIEW; automated checks and full timed
development benchmark recorded in ../reports/T028-repair-benchmark.md. Źródło: opis
koordynatora „Inteligentna pomoc do pasjansa Klondike”. To specyfikacja produktu,
nie potwierdzenie wyników badań ani skuteczności proponowanych wag.

## 1. Zakres

Zastąpić cykliczne podpowiedzi ograniczonym Best-First Search porównującym
legalne sekwencje prowadzące do celu. W aktualnym UI przycisk gry nazywa się
„Podpowiedź” (`btn-hint`); to jego dotyczy użyte w opisie słowo „Pomoc”.
Dialog zasad pozostaje dialogiem zasad. Nie dodawać drugiego przycisku.

Użyć `getLegalMoves`, niemutującego `applyMove`, `isWon` i istniejącej wiedzy
`session.knownCards`. Zachować zasady Draw 1/3, kolejność stock/waste, Undo/Redo,
historię, statystyki i schema v2. Bez backendu, modelu AI, pełnego solvera,
autogry, nowych zależności lub zmiany F04 dowodzącego braku postępu.

## 2. Kontrakt planera

Nowy DOM-free generator:
`searchSmartHint(state, knownCards, {maxStates = 10000, maxDepth = 32} = {})`.
Oddaje sterowanie pomiędzy porcjami pracy; czas mierzy kontroler, nie silnik.
Każdy yield i wynik końcowy udostępniają najlepszy dotąd wynik, aby przerwanie
czasowe nie gubiło znalezionej, legalnej sugestii.

Wynik: `{status, plan, goal, score, visitedStates, truncated}`; rekomendacja
zawiera także `components: {H,F,I,W,M,B,L}`, `verification` i `diagnostics`.

- `FOUND`: potwierdzony cel strategiczny; `plan` to legalne komendy,
  `goal` to `REVEAL` lub `FOUNDATION_ADVANCE`.
- `EXPLORATION`: plan kończy się zdobyciem nowej informacji; `goal: INFORMATION`.
- `INCONCLUSIVE`: brak wiarygodnej dodatnio ocenionej sekwencji; pusty plan,
  `goal: null`, `score: null`. Nie jest dowodem braku postępu.
- `WON`: pusty plan, bez sugestii, sprawdzane przed wyszukiwaniem.

`truncated` oznacza odcięcie przez głębokość, stany lub czas, także przy FOUND.
Nie dodawać tutaj statusu NO_PROGRESS. Wynik nigdy nie obiecuje optymalności.
Główny cel opisuje rzeczywisty efekt całej sekwencji: odsłonięcie tableau
albo dodatni przyrost baz. Waste→tableau jest przygotowaniem, nie celem.

## 3. Przeszukiwanie i budżety

1. Odczytać aktualną planszę i wiedzę, sprawdzić WON. Rozważyć wszystkie legalne
   akcje korzenia, zanim wybrać końcową sugestię; przy przerwaniu wcześniej
   oznaczyć wynik jako ograniczony, nie udawać pełnego porównania.
2. Kolejka best-first przechowuje stan, ścieżkę, jej koszt i ocenę. Kolejność
   stabilna: wyższa ocena, krótsza droga, mniejsze B, kolejność enumeracji.
3. Każdą komendę bierze się z silnika i symuluje niemutująco. Powroty z baz,
   draw i recycle są dozwolone. Undo/Redo nie należą do grafu.
4. Oceniać wszystkie znalezione cele, nie kończyć po pierwszej korzyści.
   Rozwijać także stany neutralne i przejściowo ujemne, jeśli mieszczą się
   w budżecie. Nie odrzucać całych gałęzi jak w Beam Search.
5. Odrzucać powtórzenia już osiągnięte nie droższą ścieżką. Klucz zawiera
   reguły, tryb, orientację i kolejność tableau, bazy, dokładny stock/waste
   oraz wiedzę. Można wykorzystać `progressStateKey`; nie scalać kolumn
   przez sortowanie bez dowodu zachowania komend i podświetleń.
6. Limit obejmuje maksymalnie 10 000 zachowanych różnych stanów (łącznie
   z korzeniem); domyślna maksymalna długość 32 komend. Preferencja krótkich planów wynika z kosztu
   L, nie z osobnego odcięcia. Zachować najlepszą ścieżkę do powtórzonego stanu.
7. Kontroler wykonuje krótkie porcje, początkowo około 4 ms, z celem 100 ms
   łącznego aktywnego czasu. Umożliwia anulowanie i normalne granie; nie wymaga
   workera, jeśli porcjowanie spełnia pomiary. Pojedyncze kosztowne rozwinięcie
   również należy zmierzyć. Czas oczekiwania na scheduler raportować oddzielnie.

Stały budżet stanów bez limitu zegara daje deterministyczny wynik. Limit czasu
może dawać różne jakościowo wyniki na różnych urządzeniach; nie ukrywać tego.
Nie ma obowiązku znajdowania planów dłuższych niż zadany maxDepth. Domyślne 32
pozwala przejść przez cały znany stock/waste (początkowo 24 karty) i wykonać
przygotowanie; jawne maxDepth=12 nadal ogranicza plan do 12 komend.

## 4. Granice informacji

Do oceny legalnych ruchów służą karty widoczne w danym węźle. Nie punktować
ukrytych rang/kolorów, przyszłych ruchów nowo odsłoniętej karty ani rozkładu
nieznanego stock. Identyfikatory zakrytych kart mogą być jedynie tokenami
do zachowania kolejności, wykrycia powtórzeń i sprawdzenia przynależności do
knownCards; ich wartości nie rozstrzygają priorytetu ani remisów.

Każde odsłonięcie tableau kończy gałąź, nawet gdy gracz pamiętał tę kartę.
Przy draw zakończyć gałąź, gdy którekolwiek nowo widoczne karty nie były znane.
Także zabranie karty waste może ujawnić nieznaną kartę niżej w wachlarzu:
zakończyć gałąź, bez dalszej oceny jej wartości. Do tego wykrycia użyć
`visibleCards`, zgodnie z rzeczywistym renderowaniem Draw 1/3.

Znane dobrania mogą być krokami przygotowawczymi; po ich symulowanym ukazaniu
wolno analizować widoczne karty. knownCards nie daje prawa do oceniania
aktualnie zakrytych rang w heurystyce. Na granicy informacji liczyć wyłącznie
strukturalny efekt komendy i mobilność wcześniej dostępnych kart, maskując
nowo ujawnione wartości. Planowanie nie aktualizuje wiedzy rzeczywistej sesji.

## 5. Ocena sekwencji

Rewizja naprawcza 2026-10-14: `U = 120H + 40F_goal + 20I + 10M - C - 50B`.
F_goal = F dla celu baz; dla odkrycia liczyć ujemne F oraz najwyżej jeden dodatni
przyrost, jeśli właśnie komenda odkrywająca przenosi kartę do bazy. Niezależne
wcześniejsze ruchy do baz nie podnoszą oceny odkrycia.
Premia `65W` służy wyłącznie priorytetowi kolejki (`U + 65W`), nie ocenie
publikowanej rekomendacji. C to koszt komend: 4 za transfer lub nowe dobranie,
0,5 za znane draw/recycle. Wszystkie różnice liczyć względem korzenia S0.
To kalibracja na zaobserwowanych cyklach i blokadzie znanej nawigacji, nie
dowód optymalności ani gwarancja wygranej. Raport naprawy zawiera pomiary.

- H: liczba odkrytych zakrytych kart tableau; terminalna granica zwykle daje 1.
- W: liczba różnych kart ze stock/waste w S0, które na końcu są w tableau/bazach
  po legalnym wyprowadzeniu ze skrawka. Obejmuje później dobrane znane karty.
  Nie sumować zdarzeń przeniesienia; recycle ani powrót bazy nie generuje W.
- F: liczba kart w bazach na końcu minus liczba w bazach S0 (ze znakiem).
  Powrót tej samej karty do bazy daje zero dodatkowego zysku.
- I: 1 za rzeczywiście nową informację na granicy draw lub waste fan, inaczej 0;
  nie mnożyć przez liczbę kart w Draw 3 ani przez powtarzane dobrania.
  Odkrycie tableau jest punktowane przez H niezależnie od pamiętania zakrytej karty.
- L: wszystkie komendy, także draw/recycle; automatyczne odkrycie nie dodaje L.
- M/B: mierzyć zmianę zbioru użytecznych możliwości opisanych poniżej.

Użyteczna możliwość to dostępny legalny transfer bezpośrednio odkrywający
tableau albo zwiększający bazy (także waste→foundation); ponadto transfer króla
uwalniający zakrytą kartę jest już przypadkiem odkrycia. Identyfikować ją przez
kartę początkową przenoszonego ciągu i typ korzyści, bez mnożenia równoważnych
miejsc docelowych. Wykluczyć karty wracające tylko do swojej bazy z S0.
Samo puste miejsce lub przesunięcie króla między pustymi kolumnami nie punktuje.
M = liczba nowych możliwości, B = liczba utraconych możliwości dotyczących
kart, które nadal potrzebują tego ruchu; zrealizowanie korzyści nie jest stratą.
Przeniesienie jedynego miejsca odkładania do bazy może zatem dostać karę B.
To lokalne przybliżenie mobilności, nie dowód strategicznego bezpieczeństwa.

Cel potwierdzony wymaga H>0 albo F>0. W i M są miarami pomocniczymi;
same nie tworzą FOUND. Porównanie F względem S0 wyklucza zysk z powrotu
karty baza→tableau→ta sama baza.
Wybierać dodatnio ocenione odkrycie tableau, następnie dodatnio oceniony cel baz;
jeśli ich nie znaleziono, dodatnią
eksplorację I>0; inaczej INCONCLUSIVE. Dzięki temu draw nie wypiera znanej
konkretnej drogi do celu. W remisie użyć kolejności z §3. Nie wprowadzać
nieokreślonego progu „podobnych” wyników.

Testy arytmetyki przy innych składnikach równych zero: odkrycie w 2 ruchach
112, baza w 1 ruchu 36, nowa informacja w 1 ruchu 16. Fixture całych plansz
muszą uwzględniać także M/B, nie zakładać tych sum automatycznie.

### Weryfikacja końca i diagnostyka (naprawa 2026-10-14)

Przed publikacją lepszego kandydata sprawdzić jego osiągnięty cel, dodatni
wynik, M/B i bezpośrednie legalne akcje końca. Sam osiągnięty przyrost baz jest
celem: nie wymaga następnego celu poza horyzontem i nie jest odrzucany tylko
dlatego, że brak kontynuacji. Nie utożsamiać dodatniego wyniku z bezpieczeństwem.

Kontynuować tę samą kolejkę po transferach waste i po ruchach do baz.
Na bieżąco porównywać dodatnio ocenionych kandydatów:
REVEAL przed FOUNDATION_ADVANCE przed INFORMATION, następnie wyższe U,
krótszy plan, mniejsze B, stabilna
kolejność enumeracji. Każdy yield i wynik końcowy zachowują najlepszy zaakceptowany
plan; nie ma osobnej fazy odrzucającej wcześniej opublikowane wyniki.

Usunięto końcowe przeszukiwanie grafu: odrzucało prawidłowe końcowe ruchy do
baz i mogło zgubić plan na przerwaniu. UNPROVEN oznacza nieznaną kontynuację,
TERMINAL_PROGRESS brak dalszych legalnych akcji po osiągniętym celu, WON wygraną.
Nie są to dowody wygrywalności ani NO_PROGRESS. Klucze kolejki zawierają tę samą
znormalizowaną wiedzę; przestarzały wpis o większym koszcie nie jest rozwijany.
Wynik po granicy informacji ma INFORMATION_BOUNDARY, bez analizy odsłoniętej
wartości. `verification` opisuje zakres sprawdzenia, nie obiecuje bezpieczeństwa.

`analyzeHintPlan(state, knownCards, plan)` odtwarza komendy tym samym silnikiem,
odrzuca nielegalną akcję lub kontynuację po granicy informacji i zwraca stan
końcowy oraz wspólne składniki oceny. Służy diagnostyce; UI nie wykonuje planów.
Eksport istniejącego hint zawiera nowe składniki automatycznie, bez zmiany save
schema. Diagnostyka INCONCLUSIVE podaje kandydatów, stany przygotowawcze,
odrzucenia końców i LIMIT_REACHED/NO_STRATEGIC_RECOMMENDATION.

## 6. Integracja i komunikaty

Uruchamiać na żądanie przycisku. Kolejne kliknięcie tej samej planszy może
ponownie pokazać aktualny wynik, bez cyklicznego oferowania jałowych ruchów.
Najprostsza v1 przelicza po każdej zmianie planszy zamiast przechowywać plan
między ruchami. Wykonanie podpowiedzi jest zawsze zwykłą akcją gracza.

Unieważniać wynik przy ruchu, Undo/Redo, nowej/restartowanej partii, zmianie
wiedzy lub trybu i restore. Anulować przy ukryciu/pauzie/dialogu i zniszczeniu
kontrolera. Wynik musi pasować do rewizji planszy/wiedzy i żądania; stary wynik
nie może nadpisać nowego. Tykanie zegara nie restartuje analizy.

Pokazać i ogłosić pierwszy ruch oraz cel i długość, np. „Przenieś 9♣ z bazy
na 10♥. To pierwszy z dwóch ruchów, które pozwolą odsłonić kartę.” Użyć
istniejących polskich nazw dostępnych dla czytnika i podświetleń źródła/celu.
Nie ujawniać wartości zakrytej karty. Opis widoczny również bez czytnika,
niemodalny, poprawny przy 320 px; nie usuwać fokusu ani DOM kart.

- Eksploracja: „Dobierz kartę, aby poznać kolejną możliwość.” Dla przygotowania
  recycle/znanym draw opisać faktyczny pierwszy ruch i docelowe nowe dobranie.
- INCONCLUSIVE: „Nie udało się znaleźć ruchu prowadzącego do postępu.”
- Tylko aktualne F04 NO_PROGRESS pozwala na „Brak ruchów prowadzących do
  dalszego postępu” i istniejącą sugestię nowej gry/warunkowo Undo.
- WON ma pierwszeństwo nad wszystkimi wynikami; bez podpowiedzi.

F04 PROGRESS_FOUND nie oznacza, że SmartHint znalazł plan w swoim budżecie.
F04 UNKNOWN nie oznacza braku postępu. Zachować istniejące rozróżnienie
pustej listy legalnych akcji i dowodu braku osiągalnego postępu.

## 7. Akceptacja H01–H15

| ID | Fixture / oczekiwanie |
| --- | --- |
| H01 | Bezpośrednie odkrycie: wybrać je w kontrolowanej planszy. |
| H02 | Drugi ruch odkrywa: wskazać pierwszy i cel sekwencji długości 2. |
| H03 | Baza kontra odkrycie: porównać pełne wyniki, nie kolejność enumeracji. |
| H04 | Powrót z bazy umożliwia odkrycie: znaleźć go jako pierwszy ruch. |
| H05 | Waste→tableau bez dalszego celu: przygotowanie nie tworzy FOUND. |
| H06 | Draw 3 po zabraniu waste/recycle: zachować dokładną kolejność, resztki 1/2 kart. |
| H07 | Król między pustymi kolumnami: brak jałowej sugestii i punktów za cykl. |
| H08 | Jedyna opcja to nieznany stock: EXPLORATION, bez obietnicy strategii. |
| H09 | Dwie ścieżki: zgodny z U wybór; remis preferuje krótszą, potem mniejsze B. |
| H10 | Permutacje nieznanych tableau/stock, ta sama obserwacja i wiedza: identyczny wynik. |
| H11 | Limit stanów/czasu/głębokości (także cel za 15 ruchami): nigdy NO_PROGRESS. |
| H12 | Inny ruch gracza i wynik starego żądania: stary plan odrzucony. |
| H13 | Undo/Redo, rozgałęzienie i reload: wynik dotyczy bieżącej planszy. |
| H14 | Ta sama plansza/wiedza i budżet stanów: identyczny plan, ocena i kolejność. |
| H15 | Wygrana: WON, pusty plan i brak sugestii. |

Dodatkowo: niemutowanie zamrożonych wejść; każda komenda planu legalna;
brak zmian session/save; cykl baza→kolumna→baza; kara za utratę jedynego
miejsca odkładania; maskowanie nowej karty w M/B; granica nowej karty w waste;
anulowanie, wielokrotne kliknięcia, klawiatura, live region i 320 px.
Dotychczasowe testy T027 muszą przejść bez osłabienia kryterium NO_PROGRESS.

## 8. Pomiary i kalibracja

Pierwszy etap T028 dostarcza planer i porównanie z dotychczasowym `rankHints`.
Użyć seedów 0–99 dla Draw 1 i Draw 3, maksymalnie 100 sugestii na rozdanie,
tego samego silnika i aktualizacji wiedzy po wykonanych akcjach. Baseline
wybiera pierwszy element `rankHints` po każdej zmianie planszy. SmartHint
wykonuje pierwszy ruch FOUND/EXPLORATION, kończy na INCONCLUSIVE/WON.

Raportować liczbę odkrytych kart tableau, liczbę powrotów do wcześniej
odwiedzonego stanu, liczbę kroków, zatrzymań, ukończeń, medianę/p95 czasu,
liczbę odwiedzonych stanów i odsetek odcięć. Ujawnić różne długości przebiegów;
nie interpretować samej liczby wygranych jako gwarancji przewagi. Osobno
porównać czas na tych samych zapisanych pozycjach obu algorytmów. Zapisać
seed, tryb, budżet, wersję środowiska i komendę reprodukcji.

Brak regresji w H01–H15 jest bramką; porównanie jakości jest obowiązkowym
dowodem do oceny koordynatora, nie z góry założonym wynikiem. Mobilny cel 100 ms
wymaga pomiaru na fizycznym urządzeniu; bez niego podać brak dowodu.
Szersza kalibracja wag na dużym, oddzielnym zbiorze rozdań jest drugim etapem,
do osobnego przypisania; nie tworzyć automatycznie następnego zadania.


## Follow-up koordynatora — gest wykonania podpowiedzi (2026-10-11)

Dwuklik myszą albo podwójne tapnięcie źródłowej karty aktualnie wyświetlanej
podpowiedzi wykonuje dokładnie jej pierwszy ruch przez zwykłą walidację silnika.
To świadoma akcja gracza, nie automatyczne wykonanie planu. Pozostałe karty
zachowują dotychczasowe skróty. Cofnięcie lub zmiana planszy unieważnia zalecenie.

## Follow-up — zapis do analizy (zatwierdzony 2026-10-11)

Menu udostępnia "Zapisz stan do analizy" pobierający plik JSON. Odtwarzalna
sesja używa istniejącego schema v2: seed/wersje/tryb, historia wraz z przyszłymi
ruchami, cursor, knownCards, czas i statystyki. Osobna otoczka diagnostyczna
zawiera wersję aplikacji, bieżący wynik podpowiedzi/F04 oraz budżety wyszukiwania.
Eksport nie zmienia planszy, historii, statystyk ani localStorage. Błąd pobrania
ma polski komunikat i pozwala ponowić próbę. Nie dodawać importu do UI; analizę
odtwarzać przez istniejące restoreSession na sekcji save pliku, bez nadpisywania
zapisu gracza. Test obejmuje odtworzenie po Undo i faktyczne pobranie w 320 px.

## Wznowienie i ograniczenie dowodów — 2026-10-11

Przypadek z tests/fixtures/solitaire-stan-2284836135-draw1-114.json ma być
odtwarzany przez restoreSession(save). Wymagane rozszerzenia H01–H15:
waste bez celu i z odsłonięciem, powroty z baz, ujemne przygotowanie,
alternatywy/cykle, utrata miejsca, limity, ukryte permutacje. Wymagany benchmark
0–99 obu trybów porównuje poprzedni SmartHint z rewizją na tych samych pozycjach
i przy porównywalnym budżecie, oprócz historycznego rankHints.
Koordynator następnie polecił "no tests" i wybrał "Pomiń testy i benchmark".
Nie wykonano tych bramek ani kalibracji; wagi i ograniczenia produkcyjne zachowane.

## Benchmark implementation assignment — 2026-10-14

Coordinator approved paired deals/positions and explicitly requires fast routine
comparisons with both SmartHint versions available locally. Freeze the planner
from 90fba4f under scripts/baselines, importing the same engine as current;
identify source hashes and environment in every report. Keep rankHints reference.

Quick profile: seeds 0–2 per mode, 30 moves, 128 states, depth 32, 20 ms active
time, 12 shared positions. Full: seeds 0–99 per mode, 100 moves, 10,000 states,
depth 32, 100 ms active time, 100 shared positions. Explicit CLI overrides and
separate fixed-state/time experiments must be recorded; quick is not acceptance
evidence for general strategy quality. Full fixed-state runs can be expensive.

Both algorithms see the same deals; execute only the first suggested command,
remember actual visible cards, and distinguish WON, INCONCLUSIVE and MOVE_LIMIT.
Use independent legal replay to measure reveal/net-foundation/information effects,
never compare planners' own utility values to choose a winner. Invalid plans
fail the benchmark, not masquerade as normal stops. Count repeated board and
repeated board-plus-knowledge separately. Pair old/new win and reveal outcomes;
include uncertainty among discordant wins and identical-position timings.

Collect and deduplicate start/middle/end observations from both trajectories;
always include the replayed seed 2284836135/cursor114 diagnostic. Both versions
receive each selected position and exactly the same known cards. Store positions,
histories, per-call observations and configuration in atomic local JSON reports.
Time results omit browser scheduler waits and do not replace phone/Safari checks.
