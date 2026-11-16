# Changelog

Każda wersja to jeden commit `vX.Y.Z: …` (treść commita = wpis z tego pliku) i tag `vX.Y.Z`.
Najnowsze na górze. Opis funkcji aplikacji jest w [FEATURES.md](FEATURES.md).

## [0.30.0] – 2026-11-16: domyślne tagi, low priority, P na następny dzień

- **Domyślne tagi „ważne” i „low priority”:** zawsze są na liście tagów w panelu bocznym i w podpowiedziach,
  nawet bez wpisów. Mają własne kolory: „ważne” koralowy, „low priority” szary (można zmienić jak każdy inny).
- **Przegląd dnia:** „> wszystkie niepilne” zamieniony na „> wszystkie low priority”. Przenosi na następny dzień
  tylko wpisy z tagiem „low priority”, a te są na liście lekko przygaszone.
- **„P” bez wolnego miejsca:** gdy w godzinach produktywności danego dnia nie ma wolnego miejsca, wpis trafia
  na następny dzień (albo dalszy, do 2 tygodni naprzód). Powiadomienie mówi, na kiedy, a „Cofnij” przywraca
  wpis. Liczy się to jako przeniesienie.
- Dane testowe (dev): trzy wpisy z tagiem „low priority”.

## [0.29.0] – 2026-11-16: dane testowe w trybie dev

- **Dane testowe (tylko `npm run dev`):** w „ustawienia” → „dane testowe” są przyciski „Dodaj dane testowe” /
  „Wygeneruj od nowa” i „Usuń dane testowe”. Dodają kilka tygodni wpisów wokół dziś:
  - stand-upy, siłownia co drugi dzień, wizyty, spotkania;
  - wyjazd i konferencja (kilkudniowe), urodziny;
  - wpisy z „P” i z licznikiem przeniesień („Posprzątać piwnicę” ↷9: następne przeniesienie pokaże podpowiedź);
  - dzień z wieloma wpisami;
  - 3 przypięte epiki (jeden „śpi”, jeden prawie gotowy) z zadaniami, pod-epikiem, priorytetami, terminami
    i komentarzami.
- Dane testowe są tylko lokalne (nie idą do Google, dopóki ich nie zmienisz). „Usuń” kasuje wyłącznie je.
  W zbudowanej aplikacji tej sekcji nie ma.

## [0.28.0] – 2026-11-16: P przy każdym przeniesieniu, × w okienkach, klikalny epik

- **„P” przy każdym przeniesieniu:** wpis z „P” przeniesiony na inny dzień zawsze dostaje najbliższą wolną godzinę
  w godzinach produktywności. Dotyczy też przeciągnięcia w mapie na konkretną godzinę i zmiany daty w edycji;
  wcześniej działało tylko w widoku miesiąca i przy „>”/„>>”.
- **Poprawka:** po upuszczeniu wpisu z „P” przez kilka sekund było widać starą godzinę. Teraz nowa pojawia się od razu.
- **„P” w przeglądzie dnia:** przycisk przy każdym wpisie, obok „>” i „>>” (zielony, gdy włączony).
- **× w prawym górnym rogu:** zamyka okienko wpisu po kliknięciu (szybka karta i pełna edycja; zmiany w istniejącym
  wpisie zapisuje jak klik obok), menu pod prawym przyciskiem i przegląd dnia.
- **Etykieta epiku na wpisie** w kalendarzu jest klikalna i otwiera szczegóły epiku.
- **Ustawienia:** opis progu przeniesień mówi wprost, że podpowiedź pojawia się co N przeniesień (10., 20., 30.…).

## [0.27.0] – 2026-11-16: ustawienia, przycisk P, epik bez tarcia

- **„ustawienia” na dole panelu bocznego:**
  - godziny produktywności (domyślnie 9:00–17:00);
  - długość wpisu planowanego przyciskiem „P” (domyślnie 15 min);
  - po ilu przeniesieniach podpowiedzieć pierwszy krok (przeniesione z ustawień Google);
  - „Zawsze pełna edycja po kliknięciu wpisu” (na telefonie bez szybkiej karty i „Więcej”).

  Ustawienia Google są dalej pod przyciskiem „Google Calendar…”.
- **N-te przeniesienie wpisu:** zamiast okienka z krokami jest krótka informacja w powiadomieniu. Od razu otwiera się
  pełna edycja wpisu z kursorem w tytule i podpowiedzią „Zacznij od prostego kroku — wpisz go jako tytuł”.
- **Epik bez tarcia:** pole „Epik” we wpisie to pole tekstowe z listą epików pod spodem. Wpisz nazwę i Enter:
  istniejący epik zostaje wybrany, a nowa nazwa od razu tworzy epik i przypisuje do niego wpis. „×” usuwa
  wpis z epiku.
- **Miesiąc:** wpisy z godziną są wypełnionymi kolorem blokami (jak całodniowe) z delikatną obwódką.
- **Przycisk „P”** (po najechaniu na wpis, a w pełnej edycji jako przełącznik):
  - wstawia wpis w najbliższe wolne miejsce tego dnia w godzinach produktywności; dziś nie wcześniej niż teraz;
  - wpis całodniowy dostaje ustawioną długość, wpis z godziną zachowuje swoją;
  - wpis z „P” przeniesiony na inny dzień w widoku miesiąca albo „>”/„>>” znowu dostaje najbliższą wolną
    godzinę;
  - włączone „P” widać na wpisie jako zieloną plakietkę; ponowne kliknięcie wyłącza (godzina zostaje).

  Synchronizuje się z Google.

## [0.26.0] – 2026-11-16: widok 2 tygodni i widok domyślny

- **Przycisk „2 tyg.”** obok „mapa” i „miesiąc”: siatka dwóch tygodni od tygodnia z wybranym dniem.
  Strzałki przesuwają o dwa tygodnie, „dziś” wraca do bieżącego tygodnia.
- **Widok domyślny:** po najechaniu na przycisk widoku pojawia się gwiazdka „ustaw jako widok domyślny”.
  Aplikacja otwiera się potem w tym widoku (mapa, miesiąc albo 2 tygodnie). Ustawienie jest osobne dla
  każdego urządzenia; na telefonie gwiazdki widać w szufladzie z widokami.

## [0.25.0] – 2026-11-16: odnośniki w panelu bocznym i przypięte epiki

- **Odnośniki na dole panelu bocznego:** „kalendarz” (wraca do ostatniego widoku kalendarza), „zadania i epiki”
  (z liczbą niezrobionych zadań) i „motyw”. Przycisk „zadania” zniknął z górnego paska. Tu będą trafiać
  kolejne funkcje.
- **Przypięte epiki:** pinezka przy epiku w panelu epików (widok zadań) i przycisk „przypnij” w szczegółach
  epiku. Przypięte epiki widać w panelu bocznym jako paski postępu (zrobione zadania / wszystkie, razem
  z pod-epikami). Kliknięcie otwiera szczegóły epiku.
  - Kolor paska zależy od postępu: od koralowego przez żółty do zielonego.
  - Od 80% zrobionych zadań pasek delikatnie pulsuje.
  - Gdy w epiku nic się nie zmieniło od 7 dni, pasek przygasa i unoszą się nad nim „zZz”.
  - Przy ograniczonych animacjach w systemie animacje są wyłączone.
- Przypięcie jest w kopii zadań w Google.

## [0.24.0] – 2026-11-16: komentarze do zadań i epików

- **Komentarze do zadań i epików:** w szczegółach, pod opisem, sekcja „komentarze” jak w Jirze — pole
  „Dodaj komentarz…” (Ctrl+Enter albo „Dodaj”), lista od najnowszego z datą, „edytuj” (z dopiskiem
  „edytowano”) i „usuń” (z potwierdzeniem). Komentarz zapisuje się od razu; wpisany, a niedodany komentarz
  dodaje się przy zamknięciu okna, żeby nie przepadł.
- **Licznik komentarzy** (dymek z liczbą) przy zadaniu na liście i na karcie na tablicy.
- **Szukanie** w zadaniach przeszukuje też komentarze.
- Komentarze są w kopii zadań w Google.

## [0.23.0] – 2026-11-16: zadania jak w Jirze, priorytet i własne pola

- **Zadania w układzie Jiry:** po lewej panel epików z postępem (kliknięcie filtruje), u góry pasek z szukaniem,
  grupowaniem, sortowaniem i „ukryj zrobione”, a w środku do wyboru:
  - **lista:** tabela (typ, klucz, podsumowanie, epik, priorytet, termin, szacunek, status), grupowana po epiku,
    statusie albo priorytecie, ze zmianą statusu prosto z wiersza;
  - **tablica:** kolumny do zrobienia / w toku / zrobione; przeciągnięcie karty zmienia status.
- **Klucze jak w Jirze:** PC-1, PC-2… (istniejące zadania dostały numery same).
- **Nowe pola:** priorytet (od najwyższego do najniższego), termin (po terminie na czerwono), szacunek.
- **Własne pola:** „pola” — tekst, liczba albo lista wyboru (np. „kontekst: dom, praca”), w szczegółach każdego
  zadania.
- **Szczegóły jak zgłoszenie w Jirze:** po lewej nazwa, opis i zawartość epiku, po prawej status i panel pól.
- **Epik z poziomu wpisu:** pole „Epik” jest teraz też w szybkiej karcie, a w każdym miejscu można wybrać
  „+ nowy epik…” i od razu utworzyć epik dla wpisu.

## [0.22.0] – 2026-11-16: zadania i epiki

- **Zadania i epiki:** nowy widok „zadania” (obok „mapa” i „miesiąc”), prosta „jira” do spraw osobistych.
  Epik to większa sprawa; w epiku mogą być zadania, mniejsze epiki i wpisy z kalendarza.
- **Status:** do zrobienia → w toku → zrobione, kliknięciem w pastylkę. Liczniki u góry i „ukryj zrobione”.
- **Postęp epiku:** pasek i „zrobione/wszystkie” (zadania zrobione + wpisy z kalendarza już odbyte, razem
  z pod-epikami).
- **Szczegóły zadania / epiku:** nazwa, rodzaj, status, epik nadrzędny, duże pole opisu. W epiku też jego
  zawartość, wpisy z kalendarza i „+ zaplanuj w kalendarzu”.
- **Wpis w epiku:** pole „Epik” w edycji wpisu i w menu pod prawym przyciskiem; w kalendarzu wpis ma etykietę
  epiku w jego kolorze.
- **Kopia w Google:** każde zadanie i epik to ukryty wpis 2 stycznia 2000, więc wracają na nowym urządzeniu.
  Usuwanie z „Cofnij”.

## [0.21.0] – 2026-11-15: zmiana nazwy tagu, koloruj, kropki z lewej

- **Zmiana nazwy tagu:** kliknięcie nazwy tagu w panelu bocznym otwiera pole edycji (Enter zapisuje, Esc anuluje).
  Nowa nazwa trafia do wszystkich wpisów z tym tagiem, także przeszłych, a także do reguł, filtra, koloru
  i „koloruj”. Nazwa istniejącego tagu scala oba tagi. Z „Cofnij”.
- **„koloruj” przy tagu:** wpisy z takim tagiem są pokazywane w kolorze tagu. To tylko wygląd: własny kolor wpisu
  i kolor w Google zostają, więc po wyłączeniu wszystko wraca.
- **Kropki tagów z lewej:** na wpisach kropki tagów stoją teraz przed tytułem.

## [0.20.2] – 2026-11-15: komunikat odświeżania reguł

- **Odświeżanie reguł bez mylącego komunikatu:** „↻” można używać dowolnie wiele razy, np. po dodaniu nowych reguł.
  Gdy nic nie pasuje, komunikat mówi teraz „Sprawdzono N wpisów od dziś — żadna reguła nie dodała nowego tagu”
  zamiast „Wpisy od dziś mają już tagi z reguł”, które wyglądało jak blokada po pierwszym odświeżeniu.

## [0.20.1] – 2026-11-15: zmiany serii z Google

- **Seria zmieniona w Google pojawia się w Pulsecal:** zmiana „wszystkich wydarzeń” albo „tego i następnych”
  (tytuł, godzina, usunięcie serii) trafia do Pulsecal przy najbliższym odpytaniu. Stare wystąpienia znikają,
  nowe się dodają. Dotąd zmiana godziny serii zostawiała stare kopie, a nowe pojawiały się dopiero przy
  pełnym odświeżeniu.
- **Wystąpienia serii nie odłączają się od niej:** tagi z reguł (także „↻” i „!”) dopisują się do wystąpień
  serii tylko w Pulsecal. Wcześniej wysyłały każde wystąpienie osobno do Google, co odłączało je od serii.

## [0.20.0] – 2026-11-15: odświeżanie tagów, reguła „!” i OK w menu

- **Odświeżenie tagów:** przycisk „↻” obok „reguły” w panelu bocznym przechodzi po wszystkich wpisach od dziś
  w przód i dopisuje tagi z reguł (z „Cofnij”). Przycisk w oknie reguł robi to samo („Zastosuj do wpisów od dziś”).
  Przeszłe wpisy zostają nietknięte.
- **„!” → „ważne” jako zwykła reguła:** dotąd zaszyte w kodzie, teraz jest na liście reguł jako domyślna
  „tytuł zaczyna się od „!” → ważne”. Można ją usunąć; nie wróci sama.
- **Nowy rodzaj reguły:** „tytuł zaczyna się od” (obok „zawiera słowo”).
- **Menu pod prawym przyciskiem:** nowy przycisk „OK”, który zamyka menu.

## [0.19.0] – 2026-11-15: licznik przeniesień i propozycja rozbicia wpisu

- Licznik przeniesień: wpis liczy, ile razy trafił na inny dzień (przeciągnięcie, „>”/„>>”, zmiana daty
  w edycji, przeniesienie w Google; zmiana godziny w tym samym dniu się nie liczy). Widać go jako „↷N”
  w mapie, w widoku miesiąca, w przeglądzie dnia i w edycji wpisu. Synchronizuje się z Google.
- Po każdych N przeniesieniach (ustawienia, domyślnie 10) pojawia się okienko „Przeniesiony N razy” z propozycją
  rozpisania wpisu na mniejsze kroki: dopisanie kroków do notatki albo utworzenie z nich osobnych wpisów
  (tego samego dnia, po 30 min; z „Cofnij”).
- Próg jest w kopii ustawień w Google.

## [0.18.0] – 2026-11-15: kolory tagów

- Edycja koloru tagu: w panelu bocznym po najechaniu na tag pojawia się kółko z jego kolorem — kliknięcie
  otwiera wybór koloru; „↺” wraca do koloru automatycznego. Kolor zmienia się wszędzie (kropki, pigułki, filtr).
- Kolory tagów są w kopii ustawień w Google.

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
