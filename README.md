# Pulsecal

Kalendarz-mapa (PWA) z lokalną bazą i opcjonalną kopią w Google Calendar.

## Start

```bash
npm install
npm run dev
```

Na iPhonie: Safari → Udostępnij → **Dodaj do ekranu początkowego**.

## Google Calendar

1. Google Cloud → włącz **Google Calendar API**
2. OAuth client **Web application**, dodaj origin (np. `http://localhost:5173`)
3. Wklej Client ID w ustawieniach aplikacji (kropka w prawym górnym rogu)

Odpytywanie działa, gdy PWA jest otwarte (iOS nie daje wiarygodnego tła).
