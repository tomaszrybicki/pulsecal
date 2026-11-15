# Pulsecal: opis aplikacji i log funkcji

## Czym jest Pulsecal

Pulsecal to kalendarz w stylu Google Calendar, działający jako aplikacja webowa (PWA). Na iPhonie
instaluje się go z Safari przez „Udostępnij → Dodaj do ekranu początkowego” i potem działa jak zwykła aplikacja.

Założenia:

- **Szybszy i przyjemniejszy niż Google Calendar.** Miękkie, „bąblowe” kształty, sprężyste animacje,
  lekkie „przestrzelenie” przy otwieraniu i upuszczaniu.
- **Dane najpierw na urządzeniu.** Wpisy są w lokalnej bazie przeglądarki (IndexedDB), więc kalendarz działa
  od razu i bez internetu. **Google Calendar to kopia zapasowa**: zmiany wysyłają się tam automatycznie,
  a nowe wpisy z Google są regularnie pobierane.
- **Mało tarcia.** Wpis da się dodać jednym tapnięciem i wpisaniem tytułu. W przyszłości na tym oprze się
  szybkie notowanie i inne funkcje pod ADHD.

Technologia: React 19 + TypeScript + Vite, baza Dexie (IndexedDB), animacje framer-motion,
logowanie Google bez własnego serwera (Google Identity Services).

---

## Co aplikacja potrafi

### Widoki

- **Mapa:** 21 dni obok siebie, przewijane w bok, doba w pionie. Na górze wiersz wpisów całodniowych.
  Linia „teraz” z pulsującym bąblem. Po otwarciu kalendarz pokazuje dzisiejszy dzień i bieżącą godzinę.
- **Miesiąc:** układ jak w Google Calendar.
  - Wpisy z godziną: kropka, godzina i nazwa.
  - Wpisy całodniowe i kilkudniowe: kolorowe paski przez kilka dni, także przez granicę tygodnia.
  - Kolejność w dniu: najpierw wpisy z godziną, potem całodniowe i kilkudniowe; w każdej grupie alfabetycznie.
  - Gdy wpisy się nie mieszczą: „+N więcej”.
  - **Przegląd dnia:** „+N więcej” albo przycisk „•••” na dole dnia otwiera okienko ze wszystkimi wpisami dnia.
    Przy każdym: „>” przenosi na następny dzień, „>>” o tydzień (godzina zostaje). „> wszystkie niepilne”
    przenosi na następny dzień wszystko, co nie ma tagu „pilne” ani „ważne”. „×” usuwa wpis, prawy przycisk
    myszy otwiera jego menu. Każde przeniesienie i usunięcie można cofnąć przyciskiem „Cofnij” w powiadomieniu.
  - Na telefonie wszystko jako kolorowe pigułki z samą nazwą.
  - Liczba widocznych wierszy dopasowuje się do wysokości ekranu.
- **Nawigacja:**
  - **przycisk „dziś”** w górnym pasku (i klawisz **T**) wraca do dzisiejszego dnia w obecnym widoku;
    wybrany zakres tygodni przesuwa się wtedy na bieżący tydzień;
  - strzałki ‹ › przy nazwie okresu (w miesiącu ±1 miesiąc, w mapie ±7 dni, przy wybranych tygodniach
    o tyle tygodni, ile wybrano);
  - przycisk ● na dole wraca do „teraz” w mapie;
  - tapnięcie numeru dnia w miesiącu otwiera ten dzień w mapie.
- **Przewijanie przez daty:**
  - **mapa:** przewijanie w bok nie ma końca — kolejne tygodnie doładowują się same, a widok stoi
    w miejscu. Nazwa miesiąca w górnym pasku i mały kalendarz pokazują to, co widać na ekranie.
    Kółkiem myszy nad nagłówkami dni (albo z Shiftem, albo gestem w bok na touchpadzie) przewija się daty;
    zwykłe kółko nad siatką przewija godziny;
  - **miesiąc:** kółko myszy albo przesunięcie palcem w górę/dół zmienia miesiąc (jeden gest = jeden krok);
  - **wybrane tygodnie:** kółko w bok / gest w bok za krawędzią przechodzi do kolejnego zakresu.

### Panel boczny

- **Gdzie:** przycisk ☰ w lewym górnym rogu. Na komputerze panel jest stałą kolumną z lewej
  (aplikacja pamięta, czy był otwarty). Na telefonie wysuwa się jako szuflada.
- **Przyciski funkcyjne:** na górze „nowy wpis”. Tu będą dochodzić kolejne przyciski.
- **Przełącznik widoku na telefonie:** „mapa” i „miesiąc” są w szufladzie (jak w aplikacji Google Calendar),
  bo w górnym pasku telefonu brakuje miejsca. Na komputerze zostają w górnym pasku.
- **Mały kalendarz** z numerami tygodni:
  - kliknięcie dnia przechodzi do niego w obecnym widoku;
  - **przeciągnięcie po dniach albo po numerach tygodni wybiera kilka tygodni** (do 6). Główny widok
    pokazuje wtedy dokładnie te tygodnie: w mapie jako kolumny dni, w siatce jako tyle wierszy, ile tygodni;
  - kliknięcie numeru tygodnia pokazuje ten jeden tydzień (dni wypełniają wtedy szerokość ekranu);
  - górny pasek pokazuje zakres („16 – 29 lis 2026”), a × wraca do zwykłego widoku.
- **Tagi:** lista wszystkich tagów z liczbą wpisów, opisana niżej.

### Tagi

- **Wiele tagów na wpis**, np. „przypomnienie”, „wizyta”, „remont mieszkania”, „przy komputerze”.
  Tagi mogą mieć spacje i wielkie litery („ADHD”, „Praca”); „Praca” i „praca” to ten sam tag.
- **Reguły tagów** (panel boczny → „tagi” → „reguły”): „zawiera słowo → tag” (słowo w tytule lub notatce, np.
  „dentysta” → „wizyta”; całe słowa, bez względu na wielkość liter) albo „tytuł zaczyna się od → tag”.
  Działają przy zapisie, w szybkim dodawaniu i dla wpisów z Google; tylko dodają tagi (tag usunięty ręcznie
  nie wraca przy kolejnym zapisie).
- **Odświeżenie tagów:** przycisk „↻” obok „reguły” (albo „Zastosuj do wpisów od dziś” w oknie reguł)
  przechodzi po wszystkich wpisach od dziś w przód i dopisuje tagi z reguł, z „Cofnij”. Przeszłe wpisy
  zostają nietknięte.
- **Domyślna reguła „!” → „ważne”:** tytuł zaczynający się od „!” (np. „!zapłacić czynsz”) dostaje tag „ważne”.
  To zwykła reguła na liście: można ją usunąć albo zmienić tag (usuń i dodaj własną).
- **Dodawanie:** w szybkiej karcie i w pełnej edycji jest pole „Tagi”.
  - Wpisz nazwę i naciśnij Enter albo przecinek (można też wkleić „a, b, c”).
  - Pod polem są już używane tagi do dodania jednym tapnięciem.
  - × na tagu go usuwa, a Backspace w pustym polu usuwa ostatni.
- **Na wpisach** tagi widać jako kolorowe kropki przed tytułem (kolor tagu jak w panelu bocznym).
- **Kolor tagu:** w panelu bocznym po najechaniu na tag — kółko z kolorem otwiera wybór koloru, „↺” wraca
  do automatycznego (wyliczanego z nazwy).
- **„koloruj”:** przy tagu w panelu bocznym. Włączone = wpisy z tym tagiem są pokazywane w kolorze tagu
  (gdy wpis ma kilka takich tagów, wygrywa pierwszy). To tylko wygląd w Pulsecal: własny kolor wpisu
  i kolor w Google się nie zmieniają, więc po wyłączeniu wszystko wraca. Zapisuje się w kopii ustawień.
- **Zmiana nazwy tagu:** kliknięcie nazwy tagu w panelu bocznym → pole edycji, Enter zapisuje, Esc anuluje.
  Zmienia nazwę we wszystkich wpisach (także przeszłych), w regułach, filtrze, kolorze i „koloruj”.
  Nazwa istniejącego tagu = scalenie obu tagów. Z „Cofnij”.
- **Ukrywanie i pokazywanie** w panelu bocznym:
  - odznaczenie tagu ukrywa jego wpisy;
  - „tylko” pokazuje wyłącznie ten tag;
  - „pokaż wszystkie” wyłącza filtr;
  - jest też pozycja „bez tagów”.

  Wpis z kilkoma tagami jest widoczny, jeśli choć jeden z nich jest zaznaczony, więc „tylko remont”
  pokaże wszystko, co dotyczy remontu. Filtr jest zapamiętany na urządzeniu. Jeśli zapisany wpis znika
  przez filtr, aplikacja o tym mówi.
- **W Google Calendar** tagi są w opisie wydarzenia, jako ostatnia linia:

  ```
  Kupić farbę do kuchni

  Tagi: remont mieszkania, przypomnienie
  ```

  Taką linię można też dopisać lub zmienić w samym Google Calendar, a Pulsecal ją odczyta
  (działa też „Tags:”). Musi to być ostatnia linia opisu.

### Dodawanie wpisów

- **Tapnięcie w puste miejsce** otwiera szybką kartę z kursorem w polu tytułu, a Enter zapisuje.
  - **Mapa:** wpis o godzinie, w którą tapnięto (45 min).
  - **Wiersz całodniowy w mapie:** wpis na cały dzień.
  - **Miesiąc:** wpis na cały dzień, a przycisk „+ godzina” zamienia go na wpis z godziną (jak w Google).
  - **„+” na pasku na dole:** wpis od najbliższego kwadransa.
  - **Jednym zdaniem:** przez wyszukiwarkę, opisane niżej.
- **Podgląd na żywo:** szkic od razu widać w kalendarzu (przerywana ramka), a tytuł zmienia się w trakcie pisania.
- Tapnięcie obok karty przy nowym wpisie zamyka ją bez zapisu (jak w Google).

### Szukaj i dodaj jednym zdaniem

- **Otwieranie:** pasek „Szukaj w czasie albo dodaj wpis” na dole albo klawisz **/** na komputerze.
  Okno pojawia się u góry ekranu (na telefonie klawiatura nie zasłania wyników).
- **Szukanie:** w tytułach, notatkach i tagach („#remont” też działa). Najpierw nadchodzące, potem minione;
  pasujący tekst jest podświetlony. Puste pole pokazuje najbliższe wpisy.
  Kliknięcie wyniku (albo Enter) przenosi do tego dnia i otwiera wpis.
- **Dodawanie jednym zdaniem:** na górze listy jest „Utwórz „…”” z podglądem, co zostanie zapisane. Rozumie:
  - dni: „dziś”, „jutro”, „pojutro”, „w piątek”, „za 3 dni”, „za tydzień”, „26.11”, „26.11.2027”, „2026-11-26”;
  - godziny: „14:30”, „o 10”, „9:00-10:30”, „o 9-11”;
  - długość: „30m”, „45 min”, „1h”, „1,5 h”, „2 godz”;
  - „cały dzień”;
  - tagi: „#wizyta” (wystarczy początek nazwy, jeśli pasuje tylko do jednego istniejącego tagu, np. „#rem”).

  Bez daty i godziny: dziś od najbliższego kwadransa. Data bez godziny: cały dzień.
  Przykład: „dentysta jutro 14:30 1h #wizyta”.
- **Enter:** jeśli w tekście jest data albo godzina, tworzy wpis; inaczej otwiera pierwszy wynik.
  Strzałki zmieniają zaznaczenie, Esc zamyka.

### Edycja i zmiana nazwy

- **Telefon:** tapnięcie wpisu otwiera szybką kartę. Tytuł jest tam polem do edycji, więc zmiana nazwy
  to jedno tapnięcie. Do tego przełącznik „cały dzień”, kolory oraz przyciski Usuń, Więcej i Zapisz.
- **Komputer:** kliknięcie wpisu od razu otwiera pełną edycję, bez klikania „Więcej”.
  Okno (pełna edycja i karta nowego wpisu) **wyskakuje obok kursora**: z prawej, a przy prawej krawędzi
  ekranu z lewej. Kliknięte miejsce zostaje widoczne, a zmiany widać w kalendarzu na żywo.
  Ustawienia otwierają się jako panel z prawej. Okienka przy kursorze nie blokują ekranu: kliknięcie obok
  zamyka okienko i od razu działa (np. otwiera inny wpis).
- **Szybkie akcje na komputerze:**
  - po najechaniu myszą na wpis pojawia się „×” — usuwa od razu, bez pytania; w powiadomieniu jest „Cofnij”;
  - prawy przycisk myszy na wpisie: menu z kolorami, tagami (zapisują się od razu), „Edytuj”, „Usuń” i „OK”
    (zamyka menu).
- **Pełna edycja:** tytuł, przełącznik „Cały dzień” (wtedy same daty od–do), start i koniec, notatka, kolor.
  Data wybierana z kalendarzyka z tygodniem od poniedziałku (na iPhonie systemowe kółko), godzina osobno.
  Zmiana startu zachowuje długość wpisu.
- **Zamykanie:**
  - kliknięcie obok albo Esc zapisuje zmiany w istniejącym wpisie;
  - „Anuluj” zamyka bez zapisu.

### Przesuwanie i rozciąganie

- **Gest:** myszą wystarczy chwycić i przeciągnąć. Palcem trzeba przytrzymać wpis około 0,3 s i wtedy
  przeciągnąć. Zwykły ruch palcem dalej przewija kalendarz. Esc anuluje przeciąganie.
- **Mapa:**
  - przesuwanie wpisu z godziną co 15 minut, także na inny dzień;
  - **dolna krawędź:** zmiana godziny końca;
  - **prawy dolny róg:** w dół późniejszy koniec, w bok koniec w innym dniu (wpis jednodniowy staje się kilkudniowy);
  - wpisy całodniowe: przesuwanie między dniami, a **prawa krawędź** rozciąga je na kolejne dni.
- **Miesiąc:**
  - przeciągnięcie wpisu na inny dzień (godzina zostaje ta sama);
  - **prawy róg** wpisu rozciąga go na kolejne dni albo skraca (godzina końca zostaje ta sama).
- **Wygląd:** podczas przeciągania oryginał blednie, a nad nim płynie kopia. Dni docelowe są podświetlone.
  Po upuszczeniu wpis od razu stoi w nowym miejscu i lekko się „sprężynuje”.

### Licznik przeniesień

- Wpis liczy, ile razy trafił na inny dzień (przeciągnięcie, „>”/„>>”, zmiana daty, przeniesienie w Google).
  Widać to jako „↷N” na wpisie, w przeglądzie dnia i w edycji. Zmiana godziny w tym samym dniu się nie liczy.
- Po każdych N przeniesieniach (ustawienia, domyślnie 10) Pulsecal proponuje rozpisać wpis na mniejsze kroki:
  dopisać je do notatki albo utworzyć z nich osobne wpisy tego dnia.

### Synchronizacja z Google Calendar

- **Połączenie:** w ustawieniach (kropka w prawym górnym rogu) wkleja się OAuth Client ID i klika „Połącz”.
  Po połączeniu kalendarz wybiera się z listy.
- **Wysyłanie:** każda zmiana trafia najpierw do lokalnej kolejki, a do Google wysyła się po ~1 s.
  Bez internetu kolejka czeka i wysyła się po jego powrocie.
- **Pobieranie:**
  - co 30 s (ustawialne, minimum 10 s), tylko gdy aplikacja jest na ekranie;
  - od razu po powrocie do aplikacji i po odzyskaniu internetu;
  - co 10 minut pełne odświeżenie, które wykrywa też wpisy usunięte w Google.
- **Wydarzenia cykliczne:** każde wystąpienie serii jest osobnym wpisem. Zmiana całej serii w Google
  („wszystkie wydarzenia” albo „to i następne”), łącznie ze zmianą godziny i usunięciem serii, pojawia się
  przy najbliższym odpytaniu: stare wystąpienia znikają, nowe się dodają. Edycja wystąpienia w Pulsecal
  dotyczy tylko tego jednego (jak „to wydarzenie” w Google). Tagi z reguł na wystąpieniach serii są tylko
  lokalne, żeby nie odłączać ich od serii w Google.
- **Konflikty:** wygrywa nowsza zmiana. Niewysłana lokalna zmiana nie zostanie nadpisana starszą wersją z Google.
- **Kolory:** zachowują się po synchronizacji, także między urządzeniami. Wpisy z kolorem z Google (także
  z etykietą koloru) mają dokładnie ten kolor co w Google; wpisy bez koloru — kolor kalendarza.
- **Kropka statusu:**
  - zielona: zsynchronizowane;
  - pulsująca: synchronizuje;
  - bursztynowa z napisem „połącz”: sesja Google wygasła, kliknięcie od razu loguje ponownie;
  - szara: wyłączone albo offline;
  - czerwona: błąd.

  Liczba obok kropki to wpisy czekające na wysłanie.
- **Kopia ustawień:** ukryte tagi, reguły tagów, interwał odpytywania, panel boczny i motyw zapisują się też
  w Google, w ukrytym wpisie „Pulsecal — ustawienia (nie usuwaj)” z 1 stycznia 2000. Na nowym urządzeniu
  po połączeniu odtwarzają się same (albo po kliknięciu „Przywróć”, jeśli tu były już zmieniane).
- **Komunikaty:** krótkie, sprężyste powiadomienia nad dolnym paskiem.

### Wygląd i dostępność

- **Kolory i czcionki:** ciepła „papierowa” paleta, czcionki Fraunces (nagłówki) i Outfit (interfejs).
- **Animacje:** wpisy delikatnie zmieniają kształt, a okna wjeżdżają sprężyście i zjeżdżają przy zamykaniu.
- **Ograniczony ruch:** gdy jest włączony w systemie, animacje się wyłączają.
- **Tryb ciemny:** na dole panelu bocznego „motyw: auto / jasny / ciemny”; auto podąża za ustawieniem systemu.
- **PWA:** instalowalne, z ikoną, działa offline. Nowa wersja instaluje się sama.

---

## Log zmian

Historia wersji jest w [CHANGELOG.md](CHANGELOG.md).

---

## Ograniczenia i plany

- **Ponowne logowanie do Google mniej więcej co godzinę** (jedno kliknięcie w kropkę). Bez własnego
  serwera Google nie daje trwałego dostępu. Da się to zmienić, dodając mały backend.
- **Brak synchronizacji w tle na iPhonie.** iOS nie pozwala aplikacjom webowym działać w tle,
  więc synchronizacja odbywa się, gdy aplikacja jest otwarta.
- **Wpis kilkudniowy z godziną** rysuje się w mapie jako wysokie kolumny przez kilka dni.
  Google przenosi takie wpisy do wiersza całodniowego.
- **Wymaga sprawdzenia na iPhonie:** przytrzymanie i przeciąganie palcem oraz klawiatura po tapnięciu w tytuł.
- **Tagi:** nie ma jeszcze zmiany nazwy ani usuwania tagu we wszystkich wpisach naraz, ani własnych kolorów
  tagów (kolor wynika z nazwy). Tag usunięty ze wszystkich wpisów znika z listy.
- **Opis z formatowaniem z Google** (pogrubienia, linki) po edycji wpisu w Pulsecal wraca do Google
  jako zwykły tekst.
- **Konflikty z Google:** gdy ten sam wpis zmieni się jednocześnie w Pulsecal i w Google, wygrywa nowsza
  zmiana, a druga przepada. Porządna obsługa konfliktów jest na liście TODO w `HANDOFF.md`.
- **Planowane** (kolejność w `HANDOFF.md`):
  - szersza mapa z przewijaniem bez końca;
  - zamykanie okien gestem w dół;
  - szybkie wyszukiwanie i dodawanie z paska („jutro 14:30”);
  - szybkie przyciski akcji w karcie wpisu;
  - tryb ciemny i skróty klawiszowe;
  - funkcje pod ADHD.
