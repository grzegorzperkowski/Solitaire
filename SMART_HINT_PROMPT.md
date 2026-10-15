# Prompt do zewnętrznego AI: projekt Smart Hint dla Klondike

Jesteś projektantem algorytmów wyszukiwania i podejmowania decyzji przy niepełnej
informacji. Zaprojektuj Smart Hint dla opisanej poniżej aplikacji pasjansa.
Nie masz dostępu do repozytorium. Ten dokument jest samodzielnym opisem zadania;
nie proś o źródła, pliki ani historię rozmowy. Jeśli czegoś brakuje, nazwij
założenie i zaproponuj najmniejszy potrzebny dodatek do kontraktu.

Odpowiedz po polsku. Potrzebujemy szczegółowego projektu i pseudokodu na poziomie
implementacji, nie kompletnego modułu JavaScript. Inny programista ma móc
zaimplementować go bez samodzielnego wymyślania istotnych reguł decyzyjnych.
Nie wystarczy „zastosuj A*, heurystykę i unikaj cykli”.

## 1. Cel i priorytety

Gracz naciska „Podpowiedź”, otrzymuje jeden legalny ruch i krótkie wyjaśnienie
celu. Po wykonaniu ruchu może poprosić o następną podpowiedź. Oceniaj algorytm
przez jakość CAŁEJ takiej partii, od rozdania do wygranej albo uzasadnionego
zatrzymania. Każda podpowiedź powinna pomagać w rozwiązaniu gry, a nie tylko
poprawiać lokalny wynik heurystyki.

Priorytety:

1. Legalność i brak korzystania z nieznanych zakrytych kart.
2. Jak największa szansa wygrania przy konsekwentnym wykonywaniu wskazówek.
3. Brak jałowych pętli: A→B→A, dłuższych cykli, ciągłego przekładania kart
   między kolumnami lub bazą i tableau, bezproduktywnego obiegania stock/waste.
4. Sensowne plany przygotowawcze, spójność kolejnych wskazówek i uczciwa niepewność.
5. Krótsza droga do wygranej, jeśli nie pogarsza powyższych celów.

Szybkość i optymalizacje pamięci odłożymy na później. Nie podporządkowuj
strategii obecnym limitom 100 ms ani konkretnym dotychczasowym wagom.
Obliczenia muszą jednak dać się porcjować i przerwać bez zawieszania interfejsu.
Nie proponuj nieskończonego przeszukiwania jako sposobu na pewną odpowiedź.

Wiemy, że bez znajomości zakrytych kart nie można zagwarantować wygranej każdego
rozwiązywalnego rozdania. Wyraźnie oddziel: dowód, heurystykę, oszacowanie
prawdopodobieństwa i wynik pomiaru. Nie obiecuj globalnej optymalności ani
rozwiązywalności na podstawie krótkiego planu lub dodatniej oceny.

## 2. Aplikacja i zasady

Przeglądarkowa aplikacja offline, vanilla JavaScript ES modules, bez backendu
ani zależności runtime. Silnik jest deterministyczny, bez DOM. Podpowiedź nie
wykonuje ruchów; robi to gracz przez ten sam walidowany interfejs co zwykły ruch.
Nie projektuj UI, zapisu gry, shuffle ani nowego silnika legalności.

- 52 karty, cztery kolory; as=1, król=13.
- Siedem kolumn tableau. Początkowo długości 1–7, tylko wierzchy odkryte;
  pozostałe 24 karty są w stock. Waste i cztery bazy zaczynają puste.
- Tableau układa się malejąco, z naprzemiennymi barwami czerwony/czarny.
  Przenosi się wybrany odkryty ciąg w całości: od wybranej karty do wierzchu.
  Pustą kolumnę może zająć tylko król lub ciąg zaczynający się królem.
- Bazy mają przypisane kolory kart i rosną od asa do króla.
  Wierzch bazy wolno cofnąć na legalne tableau. Baza→baza jest zabronione.
- Tylko wierzch waste jest grywalny. Stock nie można grać bez dobrania.
- Draw 1 albo Draw 3: dobierz odpowiednio do 1 albo do 3 kart, po jednej,
  ze stock na waste; ostatnia dobrana jest grywalnym wierzchem waste.
  Gdy stock zawiera mniej kart, dobiera się pozostałe. Kolejne dobranie
  jest legalne również przy niepustym waste.
- Przy pustym stock można przenieść całe waste z powrotem do stock, odwracając
  kolejność, bez tasowania. Recycle jest osobną komendą, nie dobiera karty.
  Liczba obiegów jest nieograniczona. Puste stock i waste nie dają akcji.
- Przeniesienie odsłaniające zakrytą kartę tableau automatycznie ją odkrywa;
  transfer i odkrycie są jedną komendą.
- Wygrana: wszystkie 52 karty w czterech poprawnych bazach.
- Undo/Redo są operacjami sesji, nie krawędziami grafu legalnych ruchów planera.

## 3. Dokładny model danych

Poniżej zapis przypominający typy służy opisowi; aplikacja używa zwykłego JS.

```text
CardId = integer 0..51
suitIndex(id) = floor(id / 13)
rank(id) = (id % 13) + 1
suits: 0=trefl, 1=karo, 2=kier, 3=pik
color(id): 1 i 2 czerwone, 0 i 3 czarne

GameState = {
  rulesVersion: 1,
  shuffleVersion: 1,
  seed: uint32,
  drawCount: 1 | 3,
  stock: CardId[],
  waste: CardId[],
  tableau: Array[7] of { cards: CardId[], faceUpStart: integer },
  foundations: Array[4] of CardId[]
}
```

W KAŻDEJ tablicy kart indeks 0 oznacza spód, ostatni indeks — wierzch.
W kolumnie indeksy `< faceUpStart` są zakryte, pozostałe odkryte.
Pusta kolumna ma `cards=[]`, `faceUpStart=0`. W bazach indeks odpowiada suitIndex.
Przykład kolumny: `{cards:[8,42,24,10],faceUpStart:2}` oznacza dwie zakryte
karty, a potem odkryte Q karo i J trefl, z waletem na wierzchu.

Kolejność stock/waste: stock `[D,C,B,A]`, draw3 → stock `[D]`,
waste `[A,B,C]`. Recycle waste `[A,B,C]` → stock `[C,B,A]`, waste `[]`.
To symbole przykładowych kart, nie dodatkowy typ danych.

Stan zawiera rzeczywiste ID wszystkich kart, również zakrytych. Jest to
szczegół reprezentacji silnika, NIE uprawnienie planera do ich podglądania.
Nie odtwarzaj tasowania z seed; seed i wersje to metadane zgodności.
Plansza nie przechowuje historii, pamięci gracza, zegara, statystyk ani selekcji.

### Komendy

```js
{ type: 'draw' }
{ type: 'recycle' }
{ type: 'move', from: {pile:'tableau', index:0, cardIndex:2},
                to: {pile:'tableau', index:3} }
{ type: 'move', from: {pile:'waste'},
                to: {pile:'foundation', index:1} }
{ type: 'move', from: {pile:'foundation', index:2},
                to: {pile:'tableau', index:4} }
```

Indeksy kolumn 0..6, baz 0..3. `cardIndex` wskazuje początek całego przenoszonego
odkrytego ciągu. Każde źródło tableau ma index/cardIndex, waste tylko pile,
baza pile/index. Cel ma pile/index. Brak dodatkowych pól w komendach; silnik
odrzuca także nadmiarowe pola. Przykłady pokazują kształt, nie legalność
w dowolnym stanie.

### Dostępne funkcje — przyjmij, że istnieją

```text
createGame({seed,drawCount,rulesVersion=1,shuffleVersion=1}) -> GameState
getLegalMoves(state) -> Command[]
applyMove(state,command) ->
    {ok:true,state:GameState,revealed:CardId|null} | {ok:false,reason:string}
isWon(state) -> boolean
assertInvariants(state) -> throws on invalid state, otherwise returns
rank(id), suitIndex(id), color(id)
visibleCards(state) -> CardId[]
rememberVisible(state,knownCards=[]) -> CardId[]
progressStateKey(state,knownCards) -> string
progressKeyFor(knownCards) -> function(state)->string
```

`applyMove` nie mutuje wejścia. `revealed` dotyczy automatycznego odsłonięcia
tableau; nową informację ze stock/waste wykrywa się przez widoczność.
Ruchy bierz z `getLegalMoves`, a skutki z `applyMove`; nie pisz drugiej
implementacji reguł. Enumeracja jest stabilna: draw, recycle, źródła tableau
według index i cardIndex rosnąco, waste, bazy rosnąco; cele tableau, potem bazy.
To porządek remisów, nie strategia.

`visibleCards` zwraca wszystkie odkryte karty tableau, wszystkie karty baz
oraz ostatnie `drawCount` kart waste. Zatem w Draw 3 widać wachlarz do trzech
kart, choć grać wolno tylko ostatnią.

`knownCards` jest tablicą unikalnych ID kart wcześniej widzianych przez gracza.
Po rzeczywistym ruchu sesja wykonuje `rememberVisible`, czyli sumę pamięci
z obecną widocznością. Undo nie wymazuje poznanych kart, również po zmianie
gałęzi historii. Podpowiedź nie zmienia rzeczywistej pamięci.

Dokładna semantyka dostępnego klucza:

```text
JSON.stringify([
  state.rulesVersion,
  state.drawCount,
  state.tableau.map(c => [c.faceUpStart,
                         c.cards.map((id,i) => i<c.faceUpStart ? null : id)]),
  state.foundations, state.stock, state.waste,
  sortedUnique(knownCards)
])
```

`progressKeyFor` jedynie przygotowuje stałą część wiedzy do wielokrotnego użycia.
Ukryte ID w stock/waste są tu tokenami kolejności, nie cechami do oceny.
Klucz nie sortuje kolumn ani nie zmienia indeksów komend. Dla symulacji
przekraczającej odkrycia lub hipotetycznych rozkładów zaprojektuj osobny
poprawny klucz; nie zakładaj automatycznie, że powyższy wystarczy.

## 4. Granice informacji i swoboda projektu

Rozdziel obserwację gracza, jego pamięć oraz pełny stan techniczny silnika.
Nieznane zakryte ID traktuj wyłącznie jako nieprzezroczyste tokeny dla
kolejności, równości i sprawdzania, czy karta była już znana. Ich ranga, kolor,
suit, wartość liczbowa lub faktyczne miejsce nie mogą wpływać na ocenę,
priorytety, próbkowanie, losowy seed ani rozstrzyganie remisów.

Obecna integracja stosuje następujące granice:

- Plan kończy się przy KAŻDYM odsłonięciu tableau, także zapamiętanej karty.
- Kończy się też, jeśli draw albo zdjęcie waste ujawnia jakąkolwiek kartę
  spoza wiedzy korzenia. Dotyczy to również nowego elementu wachlarza Draw 3.
- Końcowy ruch jest legalny, ale nie wolno oceniać go przez podgląd wartości
  dopiero ujawnionej karty ani rozwijać na tej podstawie dalszych ruchów.
  Dotyczy to również wywołania `getLegalMoves` na rzeczywistym stanie po odkryciu
  w celu policzenia jego mobilności lub rozstrzygnięcia remisu.
- Znane dobrania mogą być przygotowaniem. Gdy zapamiętana karta legalnie staje
  się widoczna po draw, można rozważać jej legalne ruchy. Samo członkostwo
  w knownCards nie uprawnia do oceniania obecnie zakrytej karty tableau.

To obowiązujący kontrakt publikowanego planu, a nie narzucona metoda
wyszukiwania. Możesz zaproponować ocenę probabilistyczną, plany warunkowe lub
próbkowanie NIEZNANYCH rozkładów wewnątrz algorytmu, jeśli uznasz to za potrzebne.
Wtedy zdefiniuj konstrukcję hipotez z obserwacji i pamięci, rozkład losowania,
aktualizację przekonań i agregację wyników. Nie korzystaj z prawdziwego układu
zakrytych kart. Żadna pojedyncza hipotetyczna gałąź nie jest potwierdzonym planem
w rzeczywistej grze. Publikuj wykonalny wspólny prefix do najbliższej granicy,
a następnie przelicz po faktycznej obserwacji. Jeśli wymaga to zmiany kontraktu,
wyraźnie ją nazwij i oddziel od wersji kompatybilnej.

Test uczciwości: przy zamianie tożsamości kart całkowicie nieznanych graczowi,
z zachowaniem legalnej planszy i tej samej historii obserwacji, rekomendacje
muszą być jednakowe przy stałym budżecie i ustalonej losowości. Dla tokenów
potrzebne jest spójne przemianowanie; numeryczne ID nie mogą ukradkiem
sterować kolejnością. Podaj, jak taki test przeprowadzić.

## 5. Kontrakt wywołania i wyniku

Obecny interfejs, który należy uwzględnić w projekcie:

```js
function* searchSmartHint(state, knownCards = [], {
  maxStates = 10000, maxDepth = 32, signal, previousHint,
} = {})
```

`previousHint`, jeśli podano: `{state: poprzedniaPlansza, plan: Command[]}`.
Nie jest historią całej partii. Kontroler zachowuje ostatni pokazany plan;
po ruchu ponownie woła generator, a UI wykonuje wyłącznie `plan[0]` na żądanie
gracza. Powtarzane żądanie na tej samej planszy/wiedzy pokazuje zapamiętany wynik.
Nie wolno zakładać, że kolejne żądanie dostarczy nowe losowanie.

```text
HintResult = {
  status: 'FOUND'|'EXPLORATION'|'INCONCLUSIVE'|'NO_STRATEGIC_PROGRESS'|'WON',
  plan: Command[],
  goal: 'REVEAL'|'FOUNDATION_ADVANCE'|'INFORMATION'|null,
  score: number|null,
  visitedStates: integer,
  truncated: boolean
}
```

- FOUND: legalny plan rzeczywiście odkrywa tableau lub kończy z większą liczbą
  kart w bazach niż na początku analizy. Sam powrót wcześniej cofniętej karty
  nie stanowi zysku netto względem tego korzenia.
- EXPLORATION: plan doprowadza do nowej informacji; jej korzystność jest nieznana.
- Sam waste→tableau, przestawienie kolumn, znany draw/recycle czy cofnięcie
  z bazy mogą przygotować cel, ale nie wystarczają do FOUND.
- INCONCLUSIVE: brak rekomendacji, pusty plan, goal/score=null.
- NO_STRATEGIC_PROGRESS: tylko pełne wyczerpanie grafu osiągalności bez celu
  odsłonięcia, przyrostu baz ani nowej informacji. Pusty plan, truncated=false.
  Odrzucenie celów przez heurystykę lub pamięć pętli nie jest takim dowodem.
- WON: wejściowa plansza jest już wygrana; pusty plan i goal/score=null.

Plan jest konkretną sekwencją legalnych komend, nie obietnicą wygranej.
Cel musi opisywać faktyczny efekt sekwencji. Nie wydłużaj osiągniętego celu
jałowymi ruchami dla zwiększenia punktacji. Awans baz może być końcem planu,
ale nie musi kończyć wewnętrznego rozważania dalszej strategii.

Wynik może zawierać opcjonalną diagnostykę, wyjaśnienie i oszacowanie pewności;
nie udawaj skalibrowanego prawdopodobieństwa zwykłym wynikiem heurystyki.
Obecne dodatkowe pola oceny nie narzucają nowemu projektowi konkretnych wag.
UI pokazuje po polsku pierwszy ruch, rodzaj celu i długość planu.

Generator oddaje sterowanie regularnie. Każdy yield i wynik końcowy powinny
udostępniać najlepszą dotąd sprawdzoną rekomendację, o ile istnieje.
AbortSignal kończy pracę wynikiem cząstkowym z truncated=true, zachowując plan.
Limity głębokości, stanów, czasu i próbkowania nie dowodzą wyczerpania grafu.
Nawet FOUND może mieć truncated=true. Zdefiniuj liczenie odwiedzonych stanów,
rozwinięć, hipotez i obcięć, również dla proponowanej metody probabilistycznej.

Obecne wartości 10000 stanów/32 komendy/100 ms aktywnej pracy i porcje ok. 4 ms
opisują stan aplikacji, nie cel wydajnościowy tego zadania. Zaproponuj parametry
jakościowe z wyraźnymi granicami zasobów. Dla stałych limitów pracy i ustalonej
losowości wynik powinien być powtarzalny. Zegar i planowanie porcji należą do
kontrolera; silnik nie zarządza interfejsem.

Nowy ruch, Undo/Redo, restore, restart i nowa gra unieważniają starą podpowiedź.
Pauza/ukrycie strony przerywają obliczenia. Spóźniony wynik nie nadpisuje nowszego.
Osobny istniejący detektor `searchProgress` bada formalną osiągalność dalszego
postępu. Smart Hint nie zastępuje go i nie ogłasza niewygrywalności rozdania.

## 6. Zapobieganie pętlom — obowiązkowa część projektu

Sama deduplikacja w jednym wyszukiwaniu NIE rozwiązuje pętli kolejnych żądań.
Korzeń i jego ocena resetują się po ruchu: przestawienie A→B może wyglądać
korzystnie, a następna analiza może równie wysoko ocenić B→A.

Zaprojektuj i rozpisz mechanizm obejmujący CAŁĄ partię:

- Klucz sytuacji uwzględnia mechaniczną planszę i dostępną wiedzę. Powrót
  z nową informacją nie jest automatycznie jałowym powrotem.
- Wyjaśnij, czy i kiedy potrzebujesz historii odwiedzin, wykonanych krawędzi,
  odrzuconych alternatyw, zobowiązania do planu lub innej pamięci. Pokaż jej
  dokładną strukturę i reguły odczytu/aktualizacji.
- Obecne wejście nie zawiera pełnej historii ani trwałej pamięci planera.
  Jeśli jest konieczna, zaproponuj minimalny jawny dodatek, np. plannerContext
  zarządzany przez sesję. Nie udawaj, że previousHint wystarcza, i nie ukrywaj
  zmiennej globalnej. Nie umieszczaj jej w GameState ani w knownCards.
- Określ, kiedy pamięć zmienia rzeczywisty ruch gracza, kiedy tylko symulacja,
  co po ruchu niezgodnym z sugestią, anulowaniu, Undo/Redo, rozwidleniu historii,
  restarcie, nowej grze i odtworzeniu zapisu. Jeśli wymaga persystencji lub
  odbudowy z historii, nazwij to jako zmianę integracyjną.
- Nie zakazuj wszystkich cofnięć z baz ani wszystkich powrotów do planszy:
  bywają niezbędnym przygotowaniem. Twarda lista „nigdy nie wracaj” może
  odciąć jedyną dobrą drogę; omów ten konflikt i konkretną regułę rozstrzygnięcia.
- Kontynuowanie dobrego planu musi zapobiegać oscylacji celów; plan nie może
  jednak wymusić ruchu nielegalnego, przestarzałego lub przekraczającego informację.
- Sam dodatni wynik heurystyki albo liczba kart w bazach nie dowodzą braku cyklu.
  Jeśli używasz potencjału, zdefiniuj go i pokaż, co z koniecznymi pogorszeniami.
- Jeśli nie ma bezpiecznej nowej rekomendacji, zakończ uczciwym INCONCLUSIVE
  i diagnostyką. Zakaz powtórzeń nie upoważnia do NO_STRATEGIC_PROGRESS.

Podaj, jaki dokładnie brak pętli potrafisz udowodnić, przy jakich założeniach,
a co tylko ograniczasz heurystycznie. Samo zatrzymanie zamiast pętli nie jest
sukcesem: oceń również, czy mechanizm nie obniża wygrywalności przez przedwczesne
odcięcie potrzebnych przygotowań. Nie dodawaj komendy Undo do planu bez jawnej
propozycji rozszerzenia produktu; obecna gra według wskazówek oznacza legalne
ruchy do przodu.

## 7. Oczekiwana odpowiedź

1. Krótko porównaj 2–3 podejścia odpowiednie do tych wymagań. Wybierz jedno
   i uzasadnij wybór jakością gry oraz obsługą niepełnej informacji.
2. Rozpisz model: węzeł, klucze, pamięć między wywołaniami, cele,
   warunki końca, limity i ewentualne hipotezy. Rozdziel istniejące dane
   od proponowanych dodatków integracyjnych.
3. Zdefiniuj funkcję oceny i kolejność wyboru. Wszystkie składniki, znaki,
   wagi startowe, normalizacje, progi i remisy muszą mieć konkretne znaczenie.
   Jeśli nie używasz wag, podaj równie dokładną inną regułę. Nazwij parametry
   do późniejszej kalibracji; nie pozostawiaj „dobierz dobrą heurystykę”.
4. Podaj spójny pseudokod całej drogi: żądanie → przygotowanie wiedzy →
   wyszukiwanie → wybór planu → wynik cząstkowy/końcowy → aktualizacja po
   prawdziwym ruchu → następne żądanie. Zdefiniuj każdy własny helper,
   zwłaszcza evaluate, deduplicate, select, sample i updateContext, jeśli
   występują. Tylko wymienione funkcje silnika można traktować jak gotowe.
   Opisz kolejność mutacji, warunki pętli i przerwań, nie tylko nazwy kroków.
5. Pokaż kontynuację planu i zapobieganie cyklom na konkretnych przykładach:
   A→B→A, dłuższy cykl, pełny obieg znanego stock/waste, konieczne cofnięcie
   z bazy, granica nieznanej karty oraz powrót z bogatszą wiedzą.
   Przykłady kart muszą być legalne według podanych reguł.
6. Podaj niezmienniki, uzasadnienia poprawności, słabości i sytuacje,
   w których metoda może przegrać rozwiązywalne rozdanie lub się zatrzymać.
7. Zaproponuj konkretne testy z oczekiwanymi własnościami i protokół oceny
   całych partii. Oddziel wersję bazową od przyszłych optymalizacji.

Jeśli kompletny projekt nie mieści się w jednej odpowiedzi, najpierw opisz
cały działający wariant bazowy, a dopiero potem rozszerzenia. Nie zastępuj
brakujących reguł samymi nazwami algorytmów ani kolekcją luźnych pomysłów.
Nie potrzebujemy kodu UI, instalacji bibliotek ani kompletnego kodu JS.

## 8. Sprawdzenie jakości

Wymagane testy: legalny replay każdego planu przez silnik, niemutowanie wejścia,
Draw 1/3 i krótki stock, poprawność wachlarza waste, granice informacji,
permutacje nieznanych kart, pamięć po Undo, anulowanie w dowolnym yield,
limity, terminalny ruch do bazy, legalne przygotowanie przez cofnięcie z bazy,
kontynuacja planu, wygrana oraz wszystkie scenariusze cykli z poprzedniej sekcji.
Małe pozycje porównuj z niezależnym pełnym przeszukiwaniem bez heurystycznych
odcięć. Odróżniaj osiągalność celu od jakości wybranej rekomendacji.

Benchmark całej partii: start od rozdania; po każdej analizie wykonaj dokładnie
pierwszy wskazany ruch, zaktualizuj prawdziwą pamięć i powtórz. Bez ręcznych
poprawek i bez podglądania. Mierz wygrane, stany nierozstrzygnięte, wyczerpane
bez postępu, powtórzenia plansza+wiedza, liczbę ruchów do wygranej oraz koszt
obliczeń. Osobno raportuj ujawnione karty i awanse baz; nie zastępują wygrywalności.
Limit ruchów lub obliczeń oznacza wynik ograniczony, a nie dowód przegranej.

Użyj tych samych rozdań i limitów do porównań; część rozdań odłóż na walidację,
poza dostrajaniem wag. Przy próbkowaniu powtarzaj różne ustalone losowania.
Nie twierdź, że testy przeszły, skoro nie masz silnika ani danych do ich wykonania.

Kontekst motywacyjny: w naszym silniku rozdanie seed=42, Draw 1 jest wygrywalne;
znaleziono i legalnie odtworzono rozwiązanie w 116 komendach, bez dowodu
najkrótszej drogi. Obecny Smart Hint w trzech symulacjach wygrał je w 137
komendach przy 100 ms/10000 stanów/głębokości 32. Inna rzeczywista ścieżka
utknęła po 89 komendach; pełny BFS jej pozycji obejmował 1872 stany bez postępu.
Nie masz tu sekwencji ani implementacji shuffle, więc nie możesz odtwarzać tych
wyników z samego seed. To przykład znaczenia kolejnych decyzji, nie fixture,
cel do zakodowania na sztywno ani dowód ogólnej skuteczności obecnej metody.

W odpowiedzi skup się na jednym kompletnym, możliwym do implementacji projekcie.
Celem jest lepsze prowadzenie całej gry i brak jałowych pętli; dotychczasowy
Best-First Search, kolejność celów i arbitralne wagi nie są narzuconym rozwiązaniem.
