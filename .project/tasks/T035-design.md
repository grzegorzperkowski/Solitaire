# T035 — Tańczący ludzik: badania i projekt techniczny

Data: 2026-10-25. Status: propozycja do oceny koordynatora. Zakres obejmuje dokumentację, nie wdrożenie. Podstawa kodowa: `324c17f` na `master`.

**Aktualizacja wdrożeniowa, 2026-10-25:** koordynator zlecił wdrożenie i rozszerzył zakres o losowe tańce, podbieganie i skoki. Zastępuje to poniższe założenie jednej choreografii i granicę „tylko dokumentacja”. Implementacja ma trzy rodzaje tańca (kołysanie, disco, fala), krótkie biegi i skoki. Figury trwają odpowiednio 4,8/4,4/5,2/2,8/1,8 s. Każda dochodzi do wspólnej pozy spoczynkowej przez obwiednię sin²; bieg/skok zawsze przedziela taniec, kolejna figura nie powtarza poprzedniej. Zamiast tabeli ośmiu póz użyto małych funkcji okresowych sterujących tym samym szkieletem i giętkim tułowiem. Pas ma 88/56px; na niskich ekranach, gdy stałe elementy nie mieszczą się, strona pozostaje przewijalna. Kontrakty zapisu i cyklu życia z projektu pozostają aktualne. Ten dodatek ma pierwszeństwo nad wcześniejszym zakresem, docelowe dowody są w raporcie T035.

## 1. Rekomendacja i efekt dla gracza

Zbudować jednego proceduralnie animowanego ludzika w lokalnym, liniowym SVG. W menu dodać domyślnie wyłączoną opcję „Tańczący ludzik”. Po włączeniu postać tańczy w osobnym pasie w dolnej części gry, nad komunikatami i głównymi przyciskami. Ruch obejmuje obie ręce i nogi, głowę, biodra oraz wyginający się tułów. Nie wystarczy obracać całej nieruchomej sylwetki.

Interpretacja referencji: okrągła lub lekko owalna głowa, dwa konturowe oczy, uśmiech, cienkie kończyny i swobodny gest jak w drugim przykładzie. Narysować własną geometrię inspirowaną przykładami. Nie wklejać rastrowych obrazów ani widocznej na nich szachownicy. SVG ma przezroczyste tło. Nie zakładamy praw do redystrybucji oryginalnych plików.

Na zielonym stole zastosować jasną, ciepłą kreskę (`#f8f4e9`), zgodną z istniejącym interfejsem. To świadoma adaptacja czarnego rysunku do tła gry; wygląd wymaga akceptacji wizualnej. Bez białej planszy, cienia z obrazka, ciężkich filtrów i losowego drżenia każdej klatki. Lekka asymetria głowy i krzywych daje efekt odręcznego rysunku bez migotania.

Założenia najmniejszej wersji: jedna postać, jedna zapętlona choreografia, bez dźwięku, wyboru stylów, reakcji na karty i zmiany zasad gry. Włączenie działa od razu, również przed pierwszym ruchem; nie uruchamia zegara ani nie zalicza rozpoczętej partii.

## 2. Badania i wybór techniki

Dokumentację platformy pobrano przez Context7: `resolve-library-id` → `/mdn/content` (wysoka reputacja, dokumentacja MDN), następnie trzy osobne zapytania: czas i cykl animacji, geometria SVG oraz ograniczenie ruchu. Dodatkowo sprawdzono źródła W3C i bieżący opis zdarzeń media query. Poniższa ocena kosztu opcji jest wnioskiem projektowym, nie wynikiem benchmarku.

| Technika | Ocena dla tej funkcji |
| --- | --- |
| SVG + mały model stawów + requestAnimationFrame | Wybrana. Jedna geometria skaluje się do małego ekranu; można zmieniać linie kończyn i krzywiznę pleców bez nowych zasobów i zależności. |
| Same transformacje CSS sztywnych części | Dobre dla prostego machania, ale wymagają dodatkowej geometrii i synchronizacji, żeby tułów wyraźnie się wyginał. Nie wybieramy do całej choreografii. |
| Canvas 2D | Możliwy, ale dla jednej postaci oznacza dodatkową obsługę bitmapy/DPR i mniej wygodną inspekcję geometrii. Brak wykazanej potrzeby. |
| GIF/WebP/APNG albo arkusz klatek | Wymaga przygotowania kompletu klatek i osobnej kontroli odtwarzania. Zmiana ruchu wymaga ponownego eksportu. SVG pozwala tworzyć i poprawiać ruch w kodzie. |
| Zewnętrzny runtime animacji lub fizyka | Nieuzasadniona zależność dla jednego rysunku; najpierw wykorzystać natywne możliwości. |

SVG definiuje krzywe Béziera i polecenia ścieżek `M`, `Q`, `C`; wystarczają do kończyn i giętkiego kręgosłupa. [W3C SVG Paths](https://www.w3.org/TR/SVG2/paths.html). Zaokrąglone zakończenia i połączenia kreski są dostępne jako atrybuty SVG. [MDN stroke-linecap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-linecap), [MDN stroke-linejoin](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/stroke-linejoin).

Animacja ma korzystać z czasu przekazanego do `requestAnimationFrame`, aby tempo nie zależało od częstotliwości monitora. Żądanie klatki jest jednorazowe; kolejną planuje kod, a ostatni identyfikator można anulować. [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [MDN cancelAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/cancelAnimationFrame).

Ukrywanie karty należy obsłużyć jawnie przez Page Visibility API, zamiast polegać wyłącznie na ograniczaniu klatek przez przeglądarkę. [MDN Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

Dekoracyjny ruch powinien respektować systemowe ograniczenie animacji i zmianę tej preferencji w trakcie działania. [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion), [MDN MediaQueryList change](https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/change_event). Ciągły ruch obok gry potrzebuje też łatwego wyłączenia; projekt zapewnia je w menu. W3C opisuje wymóg zatrzymania/ukrycia dla automatycznie uruchamianego ruchu trwającego ponad pięć sekund. [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).

## 3. Model postaci i choreografia

Jedno SVG z `viewBox="0 0 160 120"` i stałymi węzłami: grupa głowy (obrys, oczy, uśmiech), ścieżka tułowia, po jednej ścieżce na rękę i nogę. `fill="none"`, zaokrąglone kreski. Docelowo około 3 CSS px kreski w wersji portretowej; skontrolować czytelność najmniejszej wersji. Głowa i kończyny mają margines w całym zakresie ruchu.

Model lokalny: biodra, talia, barki/szyja, głowa, dwa łokcie, dwie dłonie, dwa kolana i dwie stopy. Poza jest obliczana z czasu przez czystą funkcję `sampleDancePose(activeMs)`. Dane pozy obejmują przesunięcie bioder, skręt osi tułowia, wygięcie pleców, przechył głowy i kąty segmentów kończyn. Nie korzystają z kart, seeda, zegara partii ani `Math.random()`.

Kończyny wyznaczać kinematyką prostą: łokieć wynika z barku i długości ramienia; dłoń z łokcia i długości przedramienia, analogicznie kolano i stopa. Kąty segmentów podrzędnych są względne wobec rodzica. Długości kości pozostają stałe. Ręka/noga to połączone segmenty `M … L … L …` z okrągłym stawem, ewentualnie lekko zakrzywione po uzyskaniu poprawnego ruchu. Nie rysować odłączonych części.

Tułów: krzywa sześcienna od bioder do barków; dwa punkty kontrolne przesuwają się względem lokalnej osi pleców. Dzięki temu barki mogą pozostać wychylone, podczas gdy talia wygina się w przeciwną stronę. Głowa podąża za szyją i ma niewielki własny przechył. Ręce startują dokładnie z obliczonych barków, nogi z bioder. Obrót grupy całego SVG nie zastępuje tych zmian.

Proponowana pętla: 8 uderzeń, 110 BPM, około 4,36 s. Osiem ręcznie opisanych póz plus powtórzona pierwsza poza na końcu. Parametry interpolować funkcją `s = u*u*(3-2*u)`; kąty zapisać w ciągłym zakresie, aby uniknąć obrotu przez 360°. To prosta stylizowana animacja, bez solvera fizyki.

| Uderzenie | Zdarzenie ruchowe |
| --- | --- |
| 0 | Ugięte kolana, ciężar na lewej nodze, jedna ręka wysoko, druga na bok. |
| 1 | Biodra w prawo, głowa z opóźnionym przechyłem, obie ręce zmieniają zgięcie. |
| 2 | Prawa stopa uniesiona, lewa pozostaje przy podłożu, ramiona nad głową. |
| 3 | Powrót stopy, przysiad i zgięcie tułowia w przód/bok. |
| 4 | Lustrzany akcent: ciężar na prawej nodze, ręce w przeciwnej konfiguracji. |
| 5 | Biodra w lewo, przeciwne wygięcie talii, głowa przechylona. |
| 6 | Lewa stopa uniesiona, ręce szeroko z wyraźnymi łokciami. |
| 7 → 8 | Wyprost i płynne dojście do pozy 0. |

Pozy dobrać tak, by stopa podporowa pozostawała blisko jednej linii podłoża; bez lewitacji, przenikania głowy i skrajnego rozciągania kończyn. Kinematyka prosta nie gwarantuje idealnie przyklejonej stopy między pozami. Dopuszczalny jest niewielki kreskówkowy poślizg; jeżeli będzie widoczny w małej postaci, najpierw poprawić pozy i tor bioder. IK rozważyć dopiero po wykazaniu potrzeby. To ograniczenie trzeba ocenić na animacji, nie na samych zrzutach.

W każdej klatce obliczyć pozę i zmienić tylko `d` ścieżek oraz transformację głowy. Nie odtwarzać SVG przez `innerHTML`, nie wywoływać renderowania całej gry i nie mierzyć DOM w pętli. Stabilna asymetria obrysu, nie losowanie geometrii co klatkę.

## 4. Położenie i małe ekrany

Kolejność pionowa: plansza z przewijanymi kolumnami → pas ludzika → istniejące komunikaty/podpowiedzi → Cofnij/Ponów/Podpowiedź/Menu → numer wersji. Postać pozostaje poza przewijanymi kolumnami. Nie używać nakładki nad kartami ani niezależnego `position: fixed` nachodzącego na pasek sterowania.

Propozycja rozmiarów do sprawdzenia: pas 88 CSS px w portrecie i na komputerze, 56 CSS px przy poziomie i wysokości ≤500px. SVG mieści cały ruch w pasie, jest wyśrodkowane i zachowuje proporcje; jego rozmiar to granica obwiedni całego tańca, nie tylko pozy spoczynkowej. Wyłączony tryb usuwa pas i jego marginesy z układu.

Obecne `src/styles.css` ogranicza scroller przez `100dvh - 195px` i `100dvh - 145px` w niskim poziomie. Samo dodanie 88px wypchnęłoby dolny interfejs. W trybie ludzika zastosować ograniczony wysokością `100dvh` pionowy flex: header/top-row i sekcja dolna bez kurczenia, `.board-area`/`.tableau-section` jako kurczliwe flexy z `min-height: 0`, a `.tableau-scroller` jako dostępne resztkowe miejsce z własnym przewijaniem. Dotychczasowe `min-height`/`max-height` scrollera wymagają nadpisania w tym trybie. Nie opierać nowego układu na kolejnej stałej odejmowanej od viewportu, bo komunikaty mogą się zawijać.

To zmiana pionowego układu, nie geometrii siedmiu kolumn. Zachować szerokość kart i obecne pasy odkrytych kart (kod ma minimum 32px), przyciski ≥44px, safe areas i normalny zoom. Dynamiczne komunikaty oraz pojawiające się przyciski przewijania muszą zmniejszać dostępną wysokość kolumn, zamiast wypychać Menu poza ekran.

Przy 568×320 postać nadal ma się pojawiać w kompaktowym pasie. Jeżeli po powiększeniu tekstu/safe areas stała część interfejsu przekroczy wysokość ekranu, dopuścić przewijanie całej strony, zapewniając dostęp do każdego przycisku i kart; nie pomniejszać kart ani ukrywać włączonej postaci bez komunikatu. Zachowanie „cały dół jednocześnie widoczny” ma pierwszeństwo w normalnym zoomie, a osiągalność w skrajnych warunkach. To istotny punkt testów.

`setupResponsiveLayout()` aktualnie ignoruje zmiany samej wysokości. Planowane dopasowanie pionowe ma być CSS, więc nie wymaga liczenia pozy przy każdej zmianie paska przeglądarki. Zmiana dostępnego miejsca wymaga ponownego sprawdzenia `checkScrollerOverflow()` oraz anulowania aktywnego gestu przy przełączeniu trybu, na wzór istniejących zmian rozmiaru. Nie rozbudowywać algorytmu szerokości kart.

## 5. Sterowanie, zapis i cykl życia

W menu natywny checkbox z etykietą „Tańczący ludzik”, obsługiwany klawiaturą i dotykiem. Cały wiersz ma co najmniej 44px wysokości. Wyłączenie jest zawsze dostępne przez istniejące Menu. Sam rysunek ma `aria-hidden="true"`, `focusable="false"`, `pointer-events: none`; nie wchodzi do kolejności Tab i nie generuje komunikatów czytnika ekranu.

Preferencja `preferences.dancingCompanion` jest booleanem, domyślnie `false`, zapisywanym wyłącznie przy zmianie preferencji istniejącą ścieżką zapisu. Stare pliki bez pola wczytać jako `false`; obecne pole innego typu odrzucić istniejącym błędem `invalid-preferences`. Zmiana addytywna nie wymaga podbijania obecnego schematu: stary klient ignoruje dodatkowe pole i może je zgubić przy następnym zapisie. To akceptowalny koszt cofnięcia wersji dla dekoracyjnej opcji, bez zmiany stanu partii. Testami potwierdzić te założenia. Bez osobnego klucza localStorage, zapisu pozy lub migracji historii.

Setter przechodzi przez istniejące `canMutateSession()`; w karcie tylko do odczytu checkbox jest nieaktywny. W grze tymczasowej użyć istniejącej polityki preferencji i zapisu; nie omijać ochrony uszkodzonego zapisu. Sprawdzić utrzymanie ustawienia przy Nowej grze/ponownym rozdaniu. Preferencja pozostaje niezależna od Undo/Redo.

| Warunek | Zachowanie |
| --- | --- |
| Opcja wyłączona | Brak pasa, brak zaplanowanych klatek. |
| Włączona, plansza dostępna, karta widoczna, aktywny właściciel | Taniec; również przed pierwszym ruchem. |
| Pauza, otwarty dialog, brak własności/konflikt, wygrana/celebracja | Zatrzymać pętlę i ukryć rysunek, zachować miejsce pasa, aby nie przesuwać planszy. |
| Karta ukryta lub `pagehide` | Anulować klatkę; wznowienie tylko po ponownym sprawdzeniu wszystkich warunków. |
| Ograniczony ruch w systemie | Włączony tryb pokazuje nieruchomą uśmiechniętą pozę, bez RAF. W menu dopisek „Animacja wyłączona przez ustawienia ograniczenia ruchu”. |
| Undo z wygranej | Wznowić dopiero, gdy stan ponownie pozwala grać; statystyki pozostają pod kontrolą obecnej sesji. |
| Zniszczenie aplikacji | Anulować RAF, odpiąć media/visibility/pagehide/pageshow, usunąć rejestrację i referencje DOM. Wielokrotne sprzątanie bez skutków ubocznych. |

Pierwszeństwo warunków: wyłączona opcja → ukryta/pauza/dialog/wygrana/brak własności → ograniczenie ruchu → taniec. Zmiana `matchMedia` działa bez reloadu. Przy wznowieniu nie doliczać czasu ukrycia: zachować aktywny czas animacji i wyzerować poprzedni timestamp. Do czasu dodawać różnice timestampów tylko podczas tańca; wyjątkowo długą przerwę pojedynczej klatki ograniczyć np. do 50ms, żeby nie przeskakiwać całej pozy po zablokowaniu wątku. To zegar dekoracji, nie zegar sesji. Jedna oczekująca klatka na instancję; identyfikator pusty jako `null`.

Samo zamknięcie strony i powrót z bfcache powinny odpowiednio wstrzymać/wznowić komponent; `pagehide` nie oznacza zawsze ostatecznego destroy. Czystą funkcję próbkowania można testować niezależnie od takiej pauzy.

## 6. Mapa przyszłej implementacji

Nazwy poniżej są projektem, nie istniejącym API.

| Miejsce | Zmiana i powód |
| --- | --- |
| Nowy `src/ui/dancing-companion.js` | `sampleDancePose(activeMs)` i `createDancingCompanion(host) → { update(state), destroy() }`; stałe SVG, mała tabela póz, RAF i lokalne listenery. Pozostawić razem, dopóki nie pojawi się potrzeba podziału. |
| `src/ui/render.js` | Stały pusty host pasa w `createBoardStructure`, przed komunikatami. Nie przebudowywać hosta przy zegarze/selekcji; zachować cache kart. |
| `src/main.js` | Utworzyć komponent raz po pierwszym renderze, wywołać `update` na początku istniejącej subskrypcji (także przed skrótem `progressOnly`), bez dodatkowej subskrypcji na klatkę. Przekazać cleanup do aplikacji. |
| `src/app.js` | Domyślna preferencja, setter z ochroną własności, ekspozycja przez istniejący `getState`; zarejestrowanie cleanup analogicznie do istniejącej animacji zwycięstwa i wywołanie w `destroy`. Sprawdzić wszystkie miejsca tworzenia/odtwarzania preferencji. |
| `src/ui/dialogs.js` | Wartość checkboxa przekazana do `renderMenuHtml`, obsługa zmiany, dopisek o ograniczeniu ruchu. Nie przebudowywać menu co klatkę. |
| `src/persistence.js` | Serializacja, walidacja pola opcjonalnego i normalizacja przy odtwarzaniu metadata; zachować poprzedni save przy błędzie. |
| `src/styles.css` | Pas i kolor kreski; układ flex włączonego trybu; wariant kompaktowy i reduced motion. |
| Testy unit/app/persistence oraz E2E layout/input/accessibility/storage | Rozszerzyć aktualne wzorce, dodać skupione testy tańca. Stare fixtures bez pola pozostają przypadkami kompatybilności. |
| REQUIREMENTS / ARCHITECTURE / TEST_PLAN | Dopisać zaakceptowane zachowanie dopiero w zadaniu wdrożeniowym; niniejsza propozycja nie zastępuje obecnych kontraktów. |

Brak zmian w `src/engine/*`, `src/session.js`, zasadach rozdania, historii, wiedzy SmartHint, statystykach i poleceniach gry. Brak zależności i zasobów sieciowych. Nowe API nie wymaga globalnych obiektów debugowania ani frameworka scen.

## 7. Kryteria przyszłej weryfikacji

1. **Geometria:** próbkować co 1/60s przez pełną pętlę; wszystkie współrzędne skończone i w obwiedni, kości stałej długości, 0 i pełny okres dają tę samą pozę. Zmieniają się obie dłonie, obie stopy, barki, biodra, krzywizna pleców i kąt głowy. Sprawdzić ciągłość granicy pętli i połączenie stawów.
2. **Życie komponentu:** wielokrotne `update` nie dubluje RAF; disable/pause/dialog/hide/read-only/win/reduced motion zatrzymują klatki; resume nie dolicza ukrytego czasu. Zmiana media query, pagehide/pageshow i destroy/remount nie zostawiają aktywnych klatek/listenerów. Obsługa zerowego timestampu poprawna.
3. **Preferencja:** round-trip true/false, brak pola w starym zapisie, odrzucenie null/string/object; błąd zachowuje oryginalny zapis. Checkbox zmienia wyłącznie preferencję: identyczne karty, cursor, commands i statystyki; save na zmianie, nigdy w RAF.
4. **Układ i wejście:** 320×568, 360×640, 390×844, 430×932, 568×320, 844×390 i desktop. Obwiednia wszystkich póz poza kartami/przyciskami; zero poziomego overflow, 7 kolumn, istniejące rozmiary kart/pasów i 44px sterowanie. Długie kolumny, zawinięta podpowiedź/progress/completion, przewijanie i Nowa gra. Przełączenie podczas gestu nie wykonuje ruchu.
5. **Dostępność:** checkbox klawiaturą, brak postaci w accessibility tree, brak przejęcia klików/fokusu; 200% tekst/zoom, ograniczony ruch od startu i zmieniony w locie. Funkcja gry działa równie poprawnie w statycznym wariancie.
6. **Wygląd:** obejrzeć przynajmniej dwie pełne pętle w małym i dużym rozmiarze, nagranie lub żywa animacja. Ocenić ręczny charakter, czytelne łokcie/kolana, wygięcia tułowia, stykanie stóp z podłożem i brak skoku pętli. Zrzuty w ustalonych fazach uzupełniają ocenę, nie zastępują jej.
7. **Wydajność:** profil z opcją on/off podczas 30 ruchów i 10s drag, zgodnie z TEST_PLAN T22; brak odczytów geometrii i zapisu w klatce, brak renderowania kart przez taniec. Zmierzyć aktualny budżet gzip po buildzie; istniejące limity ≤100KiB JS+CSS i ≤500KiB wszystkich zasobów nadal obowiązują. Nie deklarować 60fps ani małego zużycia baterii bez pomiaru.

Przy wdrożeniu: `npm run lint`, `npm test`, `npm run test:simulation -- --profile=ci`, `npm run build`, `npm run test:e2e`, kontrola builda pod subpath i `git diff --check`. Rzeczywisty iPhone/Safari oraz Android sprawdzają safe areas, paski przeglądarki, pinch, dotyk i koszt animacji; emulacja nie zamyka tej bramki. Wszystkie powyższe testy są planowane, nie wykonane w T035.

## 8. Granica decyzji

Projekt rekomenduje SVG, jedną choreografię, opt-in z zapisem i osobny pas dolny. Ustawienia koloru, rozmiaru i tempa są parametrami do dopracowania wizualnego w implementacji, nie obietnicą zweryfikowanej animacji. Największe ryzyka to mało naturalny ruch stóp i zbyt mało miejsca w krótkim poziomie. Wdrożenie wymaga osobnego polecenia koordynatora; akceptacja tego dokumentu nie jest dowodem spełnienia przyszłych testów.
