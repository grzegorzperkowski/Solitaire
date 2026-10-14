# Prompt do porównania dwóch wersji SmartHint

Porównaj załączone pliki A i B: dwie wersje planera podpowiedzi dla pasjansa
Klondike. Masz dostęp WYŁĄCZNIE do tych dwóch plików oraz poniższego opisu.
Nie masz implementacji importowanych modułów, testów, aplikacji ani benchmarków.

Chcę wiedzieć, która wersja ma większą szansę udzielać użytecznych podpowiedzi
przy ograniczonym czasie, gdzie każda może podejmować gorsze decyzje oraz jakie
różnice rzeczywiście wynikają z kodu. Nie zakładaj, że plik nowszy, większy lub
bardziej skomplikowany jest lepszy. Nie zmieniaj kodu i nie projektuj od razu
trzeciego algorytmu. Najpierw oceń A i B.

## Kontekst i wspólne kryterium produktu

To planer podpowiedzi, nie pełny solver. Szuka legalnej sekwencji, a gra pokazuje
i wykonuje na życzenie gracza tylko jej pierwszy ruch. Po wykonaniu ruchu następuje
nowe planowanie na rzeczywistej planszy i z uaktualnioną wiedzą.

Pożądane cele strategiczne to odkrycie zakrytej karty tableau albo dodatni przyrost
liczby kart w bazach względem początku planu. Zdobycie nowej informacji jest
eksploracją. Przeniesienie karty waste do tableau samo w sobie jest przygotowaniem;
może być potrzebne, ale nie dowodzi postępu strategicznego ani lepszej gry.

Rozróżnij zgodność z tym kontraktem od skuteczności strategicznej: bardziej
ostrożny planer może poprawniej opisywać cele, a jednocześnie pomijać użyteczne
drogi. Więcej odmów podpowiedzi, większa liczba kandydatów czy wyższa własna
ocena punktowa nie dowodzą przewagi. Mniej powtórzeń również może wynikać z
wcześniejszego zatrzymania. Ostatecznie interesują mnie postęp i ukończenia
partii przy porównywalnym koszcie obliczeń.

## Kontrakty środowiska — przyjmij je do analizy

- JavaScript ES modules; planer jest niezależny od DOM i zegara. Wejścia należą
  do silnika; nie wolno mutować planszy ani tablicy wiedzy. Poprawna plansza
  zawiera dokładnie 52 różne karty. Nie oceniaj braku walidacji danych z sieci
  w wewnętrznym planerze jako luki bez wykazania takiej granicy zaufania.
- CardId jest liczbą 0–51: `suitIndex = floor(CardId/13)`,
  `rank = CardId%13 + 1`. Kolejność kolorów: trefl, karo, kier, pik.
- Stosy są tablicami z wierzchem na końcu. `stock` to stos zakryty,
  `waste` to stos odkryty, `foundations` to cztery bazy.
  Każda z siedmiu kolumn tableau ma `{cards, faceUpStart}`: indeksy poniżej
  `faceUpStart` są zakryte, od tego indeksu karty są odkryte.
- Draw 1 i Draw 3 muszą działać; znaczenie mają kolejność kart, resztki stosu,
  recycle i nowa karta pojawiająca się w wachlarzu waste.
- `getLegalMoves(state)` zwraca legalne komendy dla danej planszy;
  `applyMove(state, command)` nie mutuje wejścia i zwraca wynik zawierający
  `ok`, nowy `state` i informację o odkryciu. `isWon` sprawdza wygraną.
- `visibleCards` odpowiada rzeczywiście widocznym kartom, w tym wachlarzowi
  waste. `knownCards` to karty wcześniej widziane przez gracza, także pamiętane
  po cofnięciu ruchu. Nieznane wartości nie mogą wpływać na wybór podpowiedzi.
- Identyfikatory zakrytych kart mogą służyć jako tokeny do zachowania kolejności,
  deduplikacji i sprawdzenia przynależności do wiedzy. Nie wolno punktować ich
  ukrytych rang/kolorów ani przyszłych możliwości wynikających z ich odsłonięcia.
  Samo członkostwo w `knownCards` nie uprawnia do oceniania aktualnie zakrytej
  karty w heurystyce; znaną kartę stock można analizować po jej dobraniu.
- Odkrycie tableau kończy gałąź, nawet jeśli karta była pamiętana. Gałąź kończy
  również pierwsze pokazanie nieznanych kart przy draw lub zmianie wachlarza
  waste. Nie wolno planować dalszych ruchów zależnych od właśnie uzyskanej
  informacji. Na granicy wolno ocenić efekt strukturalny ruchu, bez wykorzystania
  wartości nowo odsłoniętej karty.
- `progressStateKey` jest importowanym kluczem stanu i wiedzy. Możesz zbadać,
  jakie dane planer do niego przekazuje, ale nie możesz potwierdzić szczegółów
  jego implementacji. Podobnie nie zakładaj, jak silnik potraktuje sztuczny stan
  z zamaskowanymi wartościami; wskaż, co wymaga sprawdzenia poza plikami.
- `searchSmartHint(state, knownCards, {maxStates, maxDepth})` jest generatorem.
  Domyślnie limit to 10 000 zachowanych stanów z korzeniem i 12 ruchów planu.
  Przy stałych budżetach stanu/głębokości wynik powinien być deterministyczny.
- Kontroler poza plikami zwykle daje około 100 ms aktywnych obliczeń, uruchamia
  generator porcjami i może przerwać go po dowolnym yield. Dlatego liczy się
  zarówno wynik końcowy, jak i podpowiedzi oddawane w trakcie. Nie możesz
  potwierdzić działania kontrolera ani zachowania UI na podstawie tych plików.
- Typowe statusy: `FOUND`, `EXPLORATION`, `INCONCLUSIVE`, `WON`.
  Niepełne wyszukiwanie nie jest dowodem braku postępu ani niewygrywalności
  rozdania. `truncated` powinno uczciwie informować o odcięciu wyszukiwania;
  znaczniki odcięcia zegarem są także odpowiedzialnością zewnętrznego kontrolera.

## Oceń oba pliki według tych kryteriów

1. **Rzeczywisty cel i jakość rekomendacji.** Kiedy publikują FOUND? Czy odróżniają
   przygotowanie od celu? Czy opis odpowiada efektowi całej legalnej sekwencji?
   Czy potrafią wybierać korzystne ujawnienie zamiast pozornego zysku? Czy mogą
   odrzucać drogi, które są potrzebne do późniejszego postępu?
2. **Wyszukiwanie dróg pośrednich.** Sprawdź powroty z baz, przejściowo ujemne
   oceny, neutralne przestawienia, znane draw/recycle i sekwencje wieloruchowe.
   Rozróżnij to, co rzeczywiście odcinane, od tego, co tylko otrzymuje niższy
   priorytet. Zbadaj preferencję kategorii celu, nie tylko sumę punktów.
3. **Wiedza i granice informacji.** Szukaj wycieku ukrytych wartości przez ocenę,
   źródła i cele ruchów, mobilność, maskowanie, kolejkę, remisy i weryfikację
   końca planu. Czy permutacja nieznanych kart przy tej samej obserwacji i wiedzy
   mogłaby zmienić wynik? Samo użycie CardId nie oznacza jeszcze wycieku.
4. **Ocena efektu netto i cykle.** Prześledź wszystkie składniki punktacji,
   zwłaszcza bazę→tableau→tę samą bazę, wielokrotne liczenie tej samej karty,
   przenoszenie królów między pustymi kolumnami oraz utratę jedynego miejsca
   odkładania. Sprawdź deduplikację, krótsze drogi do tego samego stanu,
   przestarzałe wpisy kolejki i stabilność remisów. Nie porównuj samych score
   między wersjami jako dowodu jakości.
5. **Weryfikacja końca planu.** Czy odrzucanie końców bez dalszej drogi jest
   uzasadnione? Czy pełne wyczerpanie znanego grafu jest odróżnione od brakujących
   krawędzi wskutek limitu? Czy analiza respektuje granice informacji i porównuje
   korzyści względem właściwego stanu? Czy rozważa alternatywę po odrzuceniu
   najlepszego kandydata? Wykrycie lokalnego ślepego zaułka nie dowodzi przegranej
   całego rozdania.
6. **Jakość przy przerwaniu.** Co znajduje się w każdym yield? Czy wcześniej
   znaleziona dobra sugestia może zostać zastąpiona pustym lub słabiej sprawdzonym
   wynikiem w trakcie weryfikacji? Czy przerwanie przed porównaniem wszystkich
   ruchów korzenia jest rozpoznawalne? Czy metadane ograniczeń pozostają spójne?
7. **Czas i pamięć.** Wskaż konkretne różnice: wywołania silnika, powtarzane
   obliczenia korzenia, odtwarzanie planów, kopie tablic, struktury grafu,
   kolejkę, mapy, sortowanie i dodatkową weryfikację. Czy limit stanów ogranicza
   także istotne struktury pomocnicze? Czy pojedynczy `.next()` może wykonać
   dużo pracy bez yield? Nie podawaj wymyślonych milisekund, procentów poprawy
   ani ścisłych złożoności bez jawnych założeń.
8. **Czytelność i możliwość rozwoju.** Czy dodatkowy kod daje konkretną ochronę
   lub możliwości? Wskaż zbędne powtórzenia i ryzyko rozjechania dwóch ścieżek
   oceny. Krótszy kod nie jest automatycznie lepszy, a nowa warstwa weryfikacji
   nie jest automatycznie uzasadniona.

## Wymagany sposób odpowiedzi

- Zacznij od krótkiego werdyktu: co można rozstrzygnąć statycznie, która wersja
  wygląda korzystniej dla wskazanego celu i czego nie da się rozstrzygnąć.
  Dopuszczalny wynik to brak podstaw do wskazania ogólnego zwycięzcy.
- Daj tabelę A/B: cele, przygotowanie, wiedza, cykle, wynik przy przerwaniu,
  koszt i ryzyko odrzucenia użytecznego planu. Dla każdej istotnej oceny wskaż
  funkcję i konkretny fragment/linie kodu. Wskaż także zalety każdej wersji.
- Uporządkuj problemy według wpływu na gracza. Dla każdego podaj mechanizm,
  warunek wystąpienia, skutek, lokalizację i pewność. Oddziel potwierdzony błąd,
  ryzyko zależne od importowanego modułu oraz hipotezę wymagającą pomiaru.
- Dla najważniejszych różnic zaproponuj konkretny test lub minimalny scenariusz.
  Jeśli nie możesz zbudować legalnej pełnej talii bez silnika, opisz warunki
  scenariusza i oczekiwany wynik zamiast przedstawiać wymyślony fixture jako
  potwierdzoną reprodukcję. Nie twierdź, że wykonałeś test, którego nie wykonałeś.
- Zaproponuj mały eksperyment A/B: te same seedy i zapisane pozycje, identyczna
  wiedza, równy budżet stanów oraz osobno równy budżet czasu. Mierz ukończenia,
  odkrycia, powtórzenia, zatrzymania i limit ruchów, czas mediana/p95, liczbę
  stanów i odcięcia. Uwzględnij różne długości przebiegów, losowość odcięcia
  czasowego i osobny zestaw niewykorzystywany do strojenia.
- Zakończ najwyżej trzema priorytetami: co zachować, co sprawdzić najpierw,
  co ewentualnie poprawić. Nie proponuj backendu, LLM, nowych zależności ani
  kompletnego solvera bez wykazanej potrzeby.

Najważniejsze: analiza kodu może ujawnić błędy i koszty, ale sama nie dowodzi,
że jedna wersja częściej wygrywa. Bądź jednoznaczny tam, gdzie masz dowód,
i jawnie niepewny tam, gdzie masz tylko hipotezę.
