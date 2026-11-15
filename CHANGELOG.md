# Changelog

Każda wersja to jeden commit `vX.Y.Z: …` (treść commita = wpis z tego pliku) i tag `vX.Y.Z`.
Najnowsze na górze. Opis funkcji aplikacji jest w [FEATURES.md](FEATURES.md).

## [0.17.0] – 2026-11-15: klikanie obok okienek, usuwanie w przeglądzie dnia

- Okienka przy kursorze (wpis, menu pod prawym przyciskiem, przegląd dnia) nie blokują już reszty ekranu:
  kliknięcie obok zamyka okienko i od razu działa — otwiera inny wpis, tworzy wpis w slocie, zaczyna
  przeciąganie — bez drugiego kliknięcia. Edycja istniejącego wpisu zapisuje się przy takim zamknięciu.
- Przegląd dnia: większy przycisk „•••” w dniu; przy każdym wpisie przycisk „×” (usuń, z „Cofnij”) i menu
  pod prawym przyciskiem myszy.

## [0.16.0] – 2026-11-15: kopia ustawień w Google Calendar

- Kopia ustawień w Google Calendar: ukryte tagi, reguły tagów, interwał odpytywania, panel boczny i motyw
  zapisują się (kilka sekund po zmianie) w jednym ukrytym wpisie „Pulsecal — ustawienia (nie usuwaj)”
  z 1 stycznia 2000 (prywatny, czas „wolny”, Pulsecal go nie pokazuje). Opis: notka + ustawienia w JSON.
- Na nowym urządzeniu po połączeniu z Google ustawienia odtwarzają się same; jeśli na tym urządzeniu były już
  zmieniane, a w Google jest nowsza kopia — powiadomienie z „Przywróć”.
- Nigdy nie zapisujemy tokenu Google ani Client ID.
- Nie sprawdzone jeszcze na prawdziwym koncie Google.

## [0.15.0] – 2026-11-15: reguły tagów

- Reguły tagów: „słowo albo fraza w tytule lub notatce → tag” (np. „dentysta” → „wizyta”). Edycja w panelu
  bocznym: „tagi → reguły”.
- Dopasowanie całych słów, bez względu na wielkość liter, z polskimi znakami („kot” nie pasuje do „kotlet”).
- Działają przy zapisie w aplikacji, w szybkim dodawaniu i dla wpisów z Google. Tylko dodają tagi; reguła
  zadziała, gdy słowo pojawi się w tytule/notatce, więc ręcznie usunięty tag nie wraca.
- Przycisk „Zastosuj do istniejących wpisów” (z „Cofnij”).

## [0.14.0] – 2026-11-15: wybór daty od poniedziałku

- Wybór daty w pełnej edycji z tygodniem od poniedziałku: własny kalendarzyk zamiast przeglądarkowego
  (który brał pierwszy dzień tygodnia z języka systemu, np. niedzielę w angielskim Chrome). Godzina ma osobne pole.
  Zmiana daty startu przesuwa też koniec (długość wpisu zostaje).
- Na iPhonie/iPadzie zostaje systemowe kółko wyboru daty (nie ma tam siatki tygodnia).

## [0.13.0] – 2026-11-15: tryb ciemny

- Tryb ciemny: przełącznik „motyw: auto / jasny / ciemny” na dole panelu bocznego. Auto = według ustawień
  systemu (zmienia się razem z nim). Wybór zapamiętany na urządzeniu.
- Ciemne wersje tła, okien, pól, dni w widoku miesiąca i powiadomień; wpisy zostają w swoich kolorach.
  Pasek aplikacji na telefonie też ciemnieje, a przy starcie nie miga jasne tło.

## [0.12.0] – 2026-11-15: wierne kolory z Google Calendar

- Kolory z Google Calendar wiernie: wpis z kolorem (także z etykietą koloru w Google) ma dokładnie ten kolor
  co w Google, zamiast najbliższego z 6 kolorów Pulsecal (wcześniej np. grafitowy, winogronowy czy borówkowy
  wyglądały inaczej).
- Wpisy bez własnego koloru mają kolor kalendarza (jak w Google), a nie domyślny niebieski.
- Kolor tekstu na wpisie dobiera się do tła (ciemne kolory Google → jasny tekst).
- Kolor z Google wraca do Google bez zmian (ten sam colorId), także po edycji w Pulsecal.
- W wyborze koloru obecny kolor z Google jest widoczny jako dodatkowe, zaznaczone kółko.
- Już pobrane wpisy zostaną jednorazowo przekolorowane przy najbliższej synchronizacji.
- Nie sprawdzone jeszcze na prawdziwym koncie Google.

## [0.11.0] – 2026-11-15: tagi z wielkimi literami, „!” → ważne

- Tagi mogą mieć wielkie litery („ADHD”, „Praca”) — zostają tak, jak je wpisano. Porównania ignorują wielkość
  liter: „Praca” i „praca” to jeden tag (filtr, kolor, podpowiedzi, „#praca” w szybkim dodawaniu);
  w panelu bocznym widać najczęstszą pisownię.
- Tytuł zaczynający się od „!” (np. „!zapłacić czynsz”) automatycznie dostaje tag „ważne” — przy zapisie
  w aplikacji, w szybkim dodawaniu i dla wpisów z Google. Tylko gdy „!” jest nowy, więc ręcznie usunięty tag
  nie wraca. „!” zostaje w tytule.

## [0.10.0] – 2026-11-15: kropki tagów, usuwanie jednym kliknięciem, menu pod prawym przyciskiem

- Tagi widoczne na każdym wpisie jako kolorowe kropki (mapa, wpisy całodniowe, widok miesiąca);
  zastępują tekstowy dopisek z tagami w mapie.
- Komputer: po najechaniu myszą na wpis pojawia się „×” — usuwa od razu, bez potwierdzenia. Powiadomienie ma
  „Cofnij”; synchronizacja po usunięciu czeka kilka sekund, więc cofnięcie zwykle zdąży przed Google.
  Usuwanie z edycji wpisu też da się cofnąć.
- Komputer: prawy przycisk myszy na wpisie otwiera małe menu: kolory, tagi (zapisują się od razu), „Edytuj”, „Usuń”.

## [0.9.0] – 2026-11-15: przegląd dnia i porządek w widoku miesiąca

- Widok miesiąca: przyciski „mapa” i „miesiąc” są zawsze widoczne; wybrany zakres tygodni ma osobny przycisk
  („2 tyg.”), a „miesiąc” wraca do całego miesiąca.
- Widok miesiąca: w każdym dniu najpierw wpisy z godziną, potem całodniowe i kilkudniowe; w każdej grupie
  alfabetycznie.
- Przegląd dnia: „+N więcej” i nowy przycisk „•••” na dole każdego dnia z wpisami otwierają okienko ze
  wszystkimi wpisami dnia (zamiast przejścia do mapy). Przy każdym „>” (na następny dzień) i „>>” (o tydzień),
  na górze „> wszystkie niepilne” — przenosi wszystko bez tagu „pilne” ani „ważne”. Kliknięcie wpisu go otwiera.
- Powiadomienia mogą mieć przycisk „Cofnij” — przenoszenie z przeglądu dnia da się cofnąć.

## [0.8.1] – 2026-11-15: fokus i domyślny widok

- Poprawka: po otwarciu okna nowego wpisu kursor od razu stoi w polu tytułu (na komputerze okno przy kursorze
  było przez chwilę ukryte i przeglądarka ignorowała ustawienie fokusu).
- Domyślny widok po uruchomieniu: miesiąc.
- TODO: system obsługi konfliktów Google ↔ lokalna baza (plan w `HANDOFF.md`).

## [0.8.0] – 2026-11-15: szukaj i dodaj jednym zdaniem

- Pasek „Szukaj w czasie albo dodaj wpis” naprawdę szuka (wcześniej tylko otwierał nowy wpis):
  tytuły, notatki i tagi, nadchodzące przed minionymi, podświetlenie dopasowania, najbliższe wpisy przy pustym polu.
- Wynik otwiera wpis i przenosi do jego dnia.
- Dodawanie jednym zdaniem po polsku z podglądem: „dentysta jutro 14:30 1h #wizyta”, „urodziny mamy 26.11”,
  „faktury w piątek o 10”, „za 3 dni”, „30m”, „cały dzień”, tagi po początku nazwy.
- Klawisz „/” otwiera wyszukiwanie; „+” na pasku osobno tworzy pusty wpis.
- Okno wyszukiwania u góry ekranu (klawiatura telefonu nie zasłania wyników).

## [0.7.0] – 2026-11-15: przewijanie przez daty i „dziś”

- Przycisk „dziś” w górnym pasku i skrót klawiszowy T: powrót do dzisiejszego dnia w obecnym widoku.
- Mapa: przewijanie w bok bez końca (okno 6 tygodni przesuwa się samo, widok się nie przesuwa).
  Nazwa miesiąca i mały kalendarz podążają za tym, co widać.
- Mapa: kółko myszy nad nagłówkami dni przewija daty; Shift + kółko i gest w bok też.
- Miesiąc: kółko myszy i przesunięcie palcem w pionie zmieniają miesiąc, z animacją przesunięcia.
- Wybrane tygodnie: kółko / gest w bok za krawędzią przechodzi do następnego / poprzedniego zakresu.
- Poprawka: przy jednym wybranym tygodniu siatka nie przewija się już o kilkanaście pikseli w bok.
- Linie godzin rysowane jako tło (szybsze przy dłuższym oknie dni).

## [0.6.0] – 2026-11-15: okno wpisu przy kursorze

- Na komputerze okno nowego wpisu (i edycji) wyskakuje obok kursora, jak w Google Calendar:
  z prawej strony kliknięcia, przy prawej krawędzi ekranu z lewej, przy dole ekranu wyżej.
  Kliknięte miejsce i szkic wpisu zostają widoczne.
- „Więcej” otwiera pełną edycję w tym samym miejscu.
- Okno animuje się z punktu kliknięcia; przy klawiaturze i na telefonie zostaje arkusz od dołu.

## [0.5.0] – 2026-11-15: panel boczny i tagi

- Panel boczny z lewej (☰): przycisk „nowy wpis”, mały kalendarz z numerami tygodni, lista tagów.
  Na komputerze stała kolumna, na telefonie wysuwana szuflada.
- Wybór kilku tygodni w małym kalendarzu (przeciągnięcie albo numer tygodnia). Widoki pokazują
  dokładnie te tygodnie, a ‹ › przesuwają o cały zakres.
- Tagi: wiele na wpis, pole „Tagi” w szybkiej karcie i w pełnej edycji, podpowiedzi, tagi widoczne w mapie.
- Filtr tagów: pokaż / ukryj / „tylko”, „bez tagów”, „pokaż wszystkie”.
- Synchronizacja tagów z Google przez ostatnią linię opisu „Tagi: …”. Opis zmieniony w Google
  (HTML) jest zamieniany na zwykły tekst.
- Na telefonie przełącznik „mapa / miesiąc” jest w szufladzie.
- Szerokość kolumn dni liczona od miejsca obok panelu.
- Baza lokalna v3 (indeks tagów); istniejące wpisy aktualizują się same.
- Ten plik (CHANGELOG.md); usunięta nieaktualna kopia `handoff/wip/`.

> Wersje 0.2.0–0.4.0 powstały w jednej sesji, zanim ustaliliśmy zasadę „wersja = commit”.
> Nie mają osobnych commitów — są zawarte w commicie v0.5.0.

## [0.4.0] – 2026-11-15: zgodność z Google Calendar, część 2

- Rozciąganie za róg: wpis jednodniowy można rozciągnąć na kilka dni (miesiąc: prawy róg; mapa: prawy dolny
  róg wpisu z godziną, prawa krawędź wpisu całodniowego).
- Na komputerze kliknięcie wpisu od razu otwiera pełną edycję, bez „Więcej”.
- Na komputerze okna edycji i ustawień są panelem z prawej, a kalendarz zostaje widoczny.
- Esc i kliknięcie obok zapisują zmiany w istniejącym wpisie także w pełnej edycji. „Anuluj” odrzuca zmiany.
- Plik FEATURES.md z opisem aplikacji.

## [0.3.0] – 2026-11-15: zgodność z Google Calendar, część 1

- Nowy widok miesiąca: nazwy wpisów, paski kilkudniowe, „+N więcej”, wersja na telefon.
- Szybka karta do dodawania i edycji (zmiana nazwy w miejscu), podgląd szkicu na żywo w kalendarzu.
- Przeciąganie wpisów w mapie i w miesiącu, zmiana długości dolną krawędzią.
- Przełącznik „Cały dzień” w pełnej edycji.
- Strzałki ‹ › do zmiany miesiąca i tygodnia.
- Animacje zamykania okien. Spokojniejsze kształty wpisów. Respektowanie ograniczonego ruchu.

## [0.2.0] – 2026-11-15: nowa synchronizacja

- Nowy silnik synchronizacji: kolejka zmian, pobieranie przyrostowe i pełne, wykrywanie usunięć,
  zachowanie kolorów, brak duplikatów, jedna synchronizacja naraz.
- Błąd jednego wpisu nie blokuje reszty kolejki.
- Sesja Google trzymana także po zamknięciu aplikacji. Po jej wygaśnięciu stan „połącz”,
  bez samoczynnego otwierania okna logowania (Safari by je zablokował).
- Wybór kalendarza z listy. Zmiana kalendarza dopiero po potwierdzeniu, a nie przy każdym wpisanym znaku.
- Kropka statusu z licznikiem kolejki i komunikaty.
- Przykładowe wpisy z pierwszej wersji są usuwane i nie trafią do prawdziwego kalendarza.
- Poprawka: mapa otwierała się z dzisiejszym dniem schowanym za kolumną godzin.
- Poprawka: puste pole daty nie psuje już wpisu.

## [0.1.0] – pierwsza wersja (Cursor)

- Mapa dni, widok miesiąca z kropkami, dodawanie i edycja w arkuszu, lokalna baza, podstawowa synchronizacja, PWA.
- Commit `9a8ae06` (tag `v0.1.0`).
