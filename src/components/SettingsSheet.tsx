import { motion } from "framer-motion";

type Props = {
  clientId: string;
  calendarId: string;
  connected: boolean;
  status: string;
  pollSec: number;
  onClientId: (v: string) => void;
  onCalendarId: (v: string) => void;
  onPollSec: (v: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSyncNow: () => void;
  onClose: () => void;
};

export function SettingsSheet(p: Props) {
  return (
    <motion.div
      className="sheet-backdrop"
      onClick={p.onClose}
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Ustawienia"
        initial={{ y: 48, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
      >
        <div className="grab" />
        <h2>Google Calendar</h2>
        <p className="hint">
          Pulsecal trzyma wpisy lokalnie (IndexedDB). Połączenie z Google to kopia zapasowa i
          źródło nowych wydarzeń. Na iOS PWA odpytuje kalendarz tylko gdy aplikacja jest otwarta.
        </p>
        <label className="field">
          OAuth Client ID
          <input
            value={p.clientId}
            placeholder="xxx.apps.googleusercontent.com"
            onChange={(e) => p.onClientId(e.target.value)}
          />
        </label>
        <label className="field">
          Calendar ID
          <input value={p.calendarId} onChange={(e) => p.onCalendarId(e.target.value)} />
        </label>
        <label className="field">
          Interwał odpytywania (sekundy)
          <input
            type="number"
            min={15}
            max={600}
            value={p.pollSec}
            onChange={(e) => p.onPollSec(Number(e.target.value) || 30)}
          />
        </label>
        <p className="hint">
          W Google Cloud: utwórz projekt → włącz Calendar API → OAuth client typu Web → dodaj
          origin tej aplikacji (np. http://localhost:5173 oraz origin PWA).
        </p>
        <div className="row-actions">
          {p.connected ? (
            <button type="button" className="ghost" onClick={p.onDisconnect}>
              Rozłącz
            </button>
          ) : (
            <button type="button" className="ghost" onClick={p.onConnect}>
              Połącz
            </button>
          )}
          <button type="button" className="primary" onClick={p.onSyncNow}>
            Sync teraz
          </button>
        </div>
        <p className="hint">{p.status}</p>
      </motion.div>
    </motion.div>
  );
}
