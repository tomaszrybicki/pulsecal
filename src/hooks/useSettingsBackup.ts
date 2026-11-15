import { useEffect, useRef } from "react";
import {
  applySettings,
  collectSettings,
  localUpdatedAt,
  markBackedUp,
  needsBackup,
  noteLocalChange,
  settingsJson,
  type SettingsBackup,
} from "../settings";
import { NeedsAuthError, readSettingsBackup, writeSettingsBackup } from "../sync/google";
import type { NoticeAction, SyncNotice } from "./useGoogleSync";

type Notify = (text: string, tone?: SyncNotice["tone"], action?: NoticeAction) => void;

const RESTORED_FLAG = "pulsecal:settings-restored";
const BACKUP_DELAY_MS = 5000;

function restoreAndReload(b: SettingsBackup) {
  applySettings(b);
  sessionStorage.setItem(RESTORED_FLAG, "1");
  location.reload();
}

/**
 * Kopia ustawień w Google Calendar.
 * - Po każdej zmianie ustawień (deps) — zapis do Google po kilku sekundach, jeśli jest połączenie.
 * - Raz na sesję po połączeniu: jeśli w Google jest nowsza kopia → na świeżym urządzeniu odtwarzamy od razu,
 *   a jeśli ustawienia były tu zmieniane — pytamy („Przywróć”).
 */
export function useSettingsBackup(ready: boolean, notify: Notify, deps: unknown[]) {
  const checked = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const schedule = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!readyRef.current) return;
      const settings = collectSettings();
      const json = settingsJson(settings);
      if (!needsBackup(json)) return;
      writeSettingsBackup(settings, localUpdatedAt() || Date.now())
        .then(() => markBackedUp(json))
        .catch(() => undefined); // spróbujemy przy następnej zmianie / połączeniu
    }, BACKUP_DELAY_MS);
  };

  // komunikat po przeładowaniu, które nastąpiło po odtworzeniu
  useEffect(() => {
    if (sessionStorage.getItem(RESTORED_FLAG)) {
      sessionStorage.removeItem(RESTORED_FLAG);
      notify("Przywrócono ustawienia z Google");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    noteLocalChange();
    if (ready && checked.current) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!ready || checked.current) return;
    checked.current = true;
    void (async () => {
      try {
        const remote = await readSettingsBackup();
        const localJson = settingsJson(collectSettings());
        const local = localUpdatedAt();
        if (remote && settingsJson(remote.settings) !== localJson && remote.updatedAt > local) {
          if (local === 0) {
            restoreAndReload(remote);
            return;
          }
          notify("W Google jest nowsza kopia ustawień Pulsecal", "warn", {
            label: "Przywróć",
            run: () => restoreAndReload(remote),
          });
          return;
        }
        if (remote && settingsJson(remote.settings) === localJson) markBackedUp(localJson);
        schedule();
      } catch (err) {
        if (!(err instanceof NeedsAuthError)) checked.current = false; // spróbujemy przy kolejnym połączeniu
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => () => window.clearTimeout(timer.current), []);
}
