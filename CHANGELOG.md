# Changelog

Każda wersja to jeden commit `vX.Y.Z: …` (treść commita = wpis z tego pliku) i tag `vX.Y.Z`.
Najnowsze na górze. Opis funkcji aplikacji jest w [FEATURES.md](FEATURES.md).

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
