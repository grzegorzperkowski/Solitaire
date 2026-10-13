# SmartHint — specyfikacja T028

Status: IN_PROGRESS — p95/short-plan follow-up checkpoint with basic checks only,
2026-10-13; current evidence: [checkpoint](../reports/T028-p95-checkpoint.md).
Previous evidence: [report](../reports/T028-proposal-adaptation.md). Prior v3
scope/acceptance remain outstanding. Źródło: opis
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
`searchSmartHint(state, knownCards, {maxStates = 10000, maxDepth = 30, signal, previousHint} = {})`.
Oddaje sterowanie pomiędzy porcjami pracy; czas mierzy kontroler, nie silnik.
Każdy yield i wynik końcowy udostępniają najlepszy dotąd wynik, aby przerwanie
czasowe nie gubiło znalezionej, legalnej sugestii.
Anulowanie przez `signal` zwraca bezpieczny wynik cząstkowy z `truncated: true`;
nie może być raportowane jako wyczerpanie grafu.

Wynik: `{status, plan, goal, score, visitedStates, truncated}`; rekomendacja
zawiera także `components: {H,F,I,W,M,B,L}`, `verification` i `diagnostics`.
Adaptacja propozycji koordynatora (2026-10-13): końcowy znaleziony wynik zawiera
`alternatives` (maksymalnie 5), z wybraną rekomendacją na początku. Pozostałe
alternatywy kończą się na granicy informacji i mają dodatnie U oraz lokalną
weryfikację; nie wymagają dodatkowego przeszukiwania grafu. Rozróżniać je po
pierwszej komendzie i celu. Nie obiecywać wszystkich możliwych pierwszych ruchów:
deduplikacja stanów nadal zachowuje najlepszą drogę do tego samego końca.
Każda alternatywa podaje faktyczny zakres `verification`; alternatywy są tylko
diagnostyką, UI nadal pokazuje pierwszy ruch jednej rekomendacji. Kontynuacja
zapamiętanego planu i anulowanie nie muszą zawierać listy alternatyw.

- `FOUND`: potwierdzony cel strategiczny; `plan` to legalne komendy,
  `goal` to `REVEAL` lub `FOUNDATION_ADVANCE`.
- `EXPLORATION`: plan kończy się zdobyciem nowej informacji; `goal: INFORMATION`.
- `INCONCLUSIVE`: brak wiarygodnej dodatnio ocenionej sekwencji; pusty plan,
  `goal: null`, `score: null`. Nie jest dowodem braku postępu.
- `NO_STRATEGIC_PROGRESS`: pełne przeszukanie zakończyło się bez osiągalnego
  celu REVEAL, FOUNDATION_ADVANCE ani INFORMATION; `recommendedMove: null`,
  pusty `plan`, `goal: null`. Nie oznacza niewygrywalności rozdania i nie jest
  formalnym wynikiem F04.
- `WON`: pusty plan, bez sugestii, sprawdzane przed wyszukiwaniem.

`truncated` oznacza odcięcie przez głębokość, stany lub czas, także przy FOUND.
`NO_STRATEGIC_PROGRESS` wolno zwrócić wyłącznie przy `truncated: false` oraz
braku strategicznych i eksploracyjnych kandydatów. Każde odcięcie przy braku
rekomendacji pozostaje `INCONCLUSIVE`. Wynik nigdy nie obiecuje optymalności.
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
   z korzeniem); maksymalna długość 30 komend. Preferencja 1–8 wynika z kosztu
   L, nie z osobnego odcięcia. Zachować najlepszą ścieżkę do powtórzonego stanu.
7. Kontroler wykonuje krótkie porcje, początkowo około 4 ms, z celem 100 ms
   łącznego aktywnego czasu. Umożliwia anulowanie i normalne granie; nie wymaga
   workera, jeśli porcjowanie spełnia pomiary. Pojedyncze kosztowne rozwinięcie
   również należy zmierzyć. Czas oczekiwania na scheduler raportować oddzielnie.

`createApp` udostępnia te dwa limity przez `hintBatchMs` i `hintActiveMs`;
domyślne wartości produkcyjne pozostają 4 ms i 100 ms. Eksport diagnostyczny
zapisuje wartości użyte w danej instancji, aby wyniki dało się odtworzyć.

Stały budżet stanów bez limitu zegara daje deterministyczny wynik. Limit czasu
może dawać różne jakościowo wyniki na różnych urządzeniach; nie ukrywać tego.
Nie ma obowiązku znajdowania planów dłuższych niż 30 ruchów. Limit podniesiono
z 12: w 200 grach z pamięcią planu dał 46 wygranych zamiast 40, w tym samym czasie.

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

Początkowe wagi: `U = 120H + 65W + 40F + 20I + 10M - 4L - 50B`.
Nie są kalibracją naukową. Wszystkie różnice liczyć względem korzenia S0.

- H: liczba odkrytych zakrytych kart tableau; terminalna granica zwykle daje 1.
- W: liczba różnych kart ze stock/waste w S0, które na końcu są w tableau/bazach
  po legalnym wyprowadzeniu ze skrawka. Obejmuje później dobrane znane karty.
  Nie sumować zdarzeń przeniesienia; recycle ani powrót bazy nie generuje W.
- F: liczba kart w bazach na końcu minus liczba w bazach S0 (ze znakiem).
  Powrót tej samej karty do bazy daje zero dodatkowego zysku.
- I: 1 za rzeczywiście nową informację na granicy (tableau, draw lub waste fan), inaczej 0;
  nie mnożyć przez liczbę kart w Draw 3 ani przez powtarzane dobrania.
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
Rekomendacja kończy się komendą dodającą H, F lub I względem poprzedniego
węzła. Nie dopisywać przygotowań po już osiągniętym celu tylko dlatego, że
zwiększają W/M. Takie węzły nadal rozwijać w poszukiwaniu dalszych celów;
przyrost samego F nie kończy przeszukiwania gałęzi.
Wybierać wyłącznie dodatnio ocenione cele, według priorytetu REVEAL,
FOUNDATION_ADVANCE, INFORMATION; przy braku rekomendacji INCONCLUSIVE.
Dla REVEAL porównywać większe H, krótszy plan, wyższą estymację po odkryciu,
mniejsze B, wyższe U i stabilną kolejność. Dzięki temu zbędny transfer waste
nie wydłuża bezpośredniego odkrycia tylko dla punktów W. Dla INFORMATION
porównywać krótszy plan, wyższą estymację, mniejsze B, wyższe U i kolejność.
Dla FOUNDATION_ADVANCE porównywać większe F, mniejsze B, krótszy plan, wyższe U
i kolejność, aby rzeczywisty dodatkowy awans baz uzasadniał dłuższy plan,
a poboczny W przy tym samym F/B nie dodawał komend. Ten sam komparator
obowiązuje wynik cząstkowy, zapamiętywanie kandydatów i wynik końcowy.

`expectedPostRevealScore` jest pomocniczą estymacją jednej nieznanej karty,
nie nowym składnikiem U ani gwarancją ruchu/wygranej. Pula to ID 0–51 poza
knownCards i kartami widocznymi w korzeniu; nie czytać rozmieszczenia tej puli
w zakrytym tableau/stock. Dla każdego ID policzyć jedną korzyść: 2 za wejście
na bazę, inaczej 1,5 za króla przy pustej kolumnie, inaczej 1 za dopasowanie
do znanego wierzchu kolumny (ranga i przeciwny kolor). Podzielić przez rozmiar
puli, dla pustej puli zwrócić 0. Pominąć właśnie odsłonięty wierzch tableau,
także zapamiętany. Estymować tylko na granicy; w pozostałych końcach 0.
Nie zmieniać wag U ani dodatniego progu przeciw pętlom. Nie gwarantować
minimalnego planu w ograniczonym grafie.

W checkpoint p95 (2026-10-13) statystyki nieznanych rang/kolorów obliczyć raz
w tablicy 28 liczników. Estymacja używa maski miejsc docelowych bez alokowania
tablic, zbiorów i callbacków przy każdym wywołaniu. Nie liczyć tej samej karty
ponownie dla baz i kolumn/króla. Weryfikację danego kandydata współdzielić przy
zapisie i wyborze; klucz alternatyw budować z pól pierwszej komendy i celu.

Na końcu skracać tylko wybranego zwycięzcę: zachłannie usuwać pojedynczą komendę
przed ostatnią, odtwarzając legalność i tę samą granicę. Zachować co najmniej
pierwotne H/F/I, ten sam typ celu, dodatnie U i B nie większe od pierwotnego.
Dla końca bez granicy zachować dokładny klucz końcowego stanu i nie dodawać
nowych przodków do wykluczeń istniejącego dowodu grafowego. Inne skrócenie
wymaga ponownej weryfikacji grafu i nie należy do tego checkpointu.
Oddawać sterowanie po każdej próbie, zachowując sprawdzony plan przy anulowaniu.
Raportować shorteningAttempts/shortenedPlansCount/savedMovesCount. Nie obiecywać
globalnej minimalności ani kosztu <0,1 ms; pełne testy i pomiar są odroczone.

Testy arytmetyki przy innych składnikach równych zero: odkrycie w 2 ruchach
112, baza w 1 ruchu 36, nowa informacja w 1 ruchu 16. Fixture całych plansz
muszą uwzględniać także M/B, nie zakładać tych sum automatycznie.

### Weryfikacja końca i diagnostyka (rewizja 2026-10-11)

Przed publikacją lepszego kandydata sprawdzić jego osiągnięty cel, dodatni
wynik, M/B i bezpośrednie legalne akcje końca. Odrzucić koniec bez dalszych
akcji albo z samym bezpośrednim powrotem do S0, chyba że to wygrana lub granica
informacji. Nie utożsamiać dodatniego wyniku z bezpieczeństwem strategicznym.

Kontynuować tę samą kolejkę po transferach waste i po ruchach do baz. Po
zakończeniu głównego wyszukiwania porównywać dodatnio ocenionych kandydatów:
według wspólnego porządku z §5 (krótsze REVEAL przed pobocznym W).
Odczyt istniejących krawędzi grafu sprawdza, czy z końca
kandydata można osiągnąć odsłonięcie, nową informację lub dalszy przyrost baz.
Nie symuluje nowych stanów i nie przekracza granic informacji.
Nie przechodzi ponownie przez S0: dojście do celu inną gałęzią z korzenia
nie potwierdza korzystnej kontynuacji wybranego kandydata.

KNOWN_DEAD_END oznacza wyłącznie wyczerpaną część znanego grafu względem
końca kandydata; odrzucić taką rekomendację i rozważyć następną. Brak pełnego
grafu daje UNPROVEN, nie dowód impasu. Łączny limit odczytów weryfikacji to
maxStates, z yield co 64 odczyty oraz między alternatywnymi kandydatami;
wyczerpanie limitu ustawia truncated. To nie solver wygrywalności ani NO_PROGRESS.
Limit odczytów liczy wyłącznie nowe, niewykluczone węzły danej weryfikacji;
pozostały na stosie duplikat lub S0 nie oznacza obcięcia. `children` zachowuje
także klucze następców odciętych limitem; przed końcową weryfikacją przeliczyć
kompletność po późniejszych krótszych ścieżkach. `unresolvedCutoffs` liczy
krawędzie do nadal brakujących węzłów, a `unexpandedStates` zapamiętane stany
z nierozwiniętą najlepszą ścieżką. Historyczne trafienia limitów nie przesądzają
końcowego `truncated`. Brakujący węzeł lub nierozwinięty stan pozostaje niepewny.
Kandydatury celu zachować niezależnie od możliwości zapamiętania ich planszy;
nie rozwijać dodatkowych stanów poza budżetem. Anulowanie zachowuje kandydaturę
sprawdzoną co najmniej lokalnie, która nie została odrzucona przez weryfikację;
zawsze ustawia `truncated`, także między kandydatami i po yield grafu.
Wynik po granicy informacji ma INFORMATION_BOUNDARY, bez analizy odsłoniętej
wartości. `verification` opisuje zakres sprawdzenia, nie obiecuje bezpieczeństwa.

`analyzeHintPlan(state, knownCards, plan)` odtwarza komendy tym samym silnikiem,
odrzuca nielegalną akcję lub kontynuację po granicy informacji i zwraca stan
końcowy oraz wspólne składniki oceny. Służy diagnostyce; UI nie wykonuje planów.
Eksport istniejącego hint zawiera nowe składniki automatycznie, bez zmiany save
schema. Diagnostyka INCONCLUSIVE podaje kandydatów, stany przygotowawcze,
odrzucenia końców i LIMIT_REACHED/NO_STRATEGIC_RECOMMENDATION.
`nonPositiveGoals` liczy cele REVEAL/FOUNDATION_ADVANCE odrzucone przez U <= 0.
Próg U > 0 zostaje: bez niego zdjęcie karty z bazy dla odsłonięcia tworzy pętlę
podpowiedzi (fixture `smart-hint-seed21-draw1-61.json`).

## 6. Integracja i komunikaty

Uruchamiać na żądanie przycisku. Kolejne kliknięcie tej samej planszy może
ponownie pokazać aktualny wynik, bez cyklicznego oferowania jałowych ruchów.
Kontroler pamięta ostatni pokazany plan i jego planszę (`previousHint`).
Gdy plansza to wynik pierwszego ruchu planu, następna podpowiedź to reszta planu
(`continued: true`), bez nowego wyszukiwania. Warunki: ruchy legalne, bez granicy
informacji, a reszta nadal osiąga cel względem nowej planszy.
Powód: U liczone względem S0 zmienia się po jednym ruchu. Nowe wyszukiwanie
potrafi wtedy cofnąć poprzedni ruch i podpowiedzi krążą bez końca
(fixture `smart-hint-seed1-draw1-76.json`). Każdy ukończony plan odsłania kartę,
zwiększa bazy albo daje wiedzę, więc idąc za podpowiedziami nie da się zapętlić.
Inna plansza oznacza zwykłe wyszukiwanie. Wykonanie podpowiedzi jest zawsze
zwykłą akcją gracza.

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
- NO_STRATEGIC_PROGRESS: „Nie znaleziono posunięcia, które przybliża do
  rozwiązania.” Gdy historia pozwala na Undo, zasugerować cofnięcie kilku
  ostatnich ruchów lub rozpoczęcie gry od początku; bez historii sugerować
  rozpoczęcie nowej gry. Status nie zastępuje wyniku F04.
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


## F04 reachable-progress follow-up — 2026-10-11

`searchProgress` keeps its BFS, cycle key, state budget and four statuses.
Classify each `applyMove` result against fixed analysis-root data: REVEAL when
`revealed != null`, FOUNDATION_ADVANCE when total foundation cards exceed the
initial count, and INFORMATION when `visibleCards(after)` includes an ID outside
`rememberVisible(initial, knownCards)`. Everything else remains in the BFS,
including waste→tableau, known draws and foundation returns. Stop at the first
goal without expanding revealed values. `PROGRESS_FOUND` gains optional `goal`;
all callers continue to use status. `UNKNOWN` remains mandatory if the state
budget prevents exhaustive neutral-state search. No depth limit. SmartHint's
sequence quality and scoring are independent from this reachability contract.
