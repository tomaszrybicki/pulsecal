import { useEffect, useState } from "react";
import { clearSeed, hasSeed, seedTestData } from "../devSeed";

/** Tylko w trybie dev (npm run dev): dodaj / usuń dane testowe (wpisy, epiki, zadania). */
export function DevSeed() {
  const [present, setPresent] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void hasSeed().then(setPresent);
  }, []);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    try {
      setMsg(await fn());
      setPresent(await hasSeed());
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="prefs-group">
      <h3>dane testowe (tylko dev)</h3>
      <p className="hint">
        Kilka tygodni wpisów wokół dziś (praca, siłownia, wizyty, wyjazd, wpisy z „P” i z przeniesieniami) oraz epiki
        z zadaniami i komentarzami. Tylko lokalnie — nie trafiają do Google, dopóki ich nie zmienisz.
      </p>
      <div className="row-actions dev-seed">
        <button
          type="button"
          className="ghost"
          disabled={busy || !present}
          onClick={() => void run(async () => `Usunięto ${await clearSeed()} pozycji testowych.`)}
        >
          Usuń dane testowe
        </button>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await seedTestData();
              return `Dodano ${r.events} wpisów i ${r.items} zadań/epików.`;
            })
          }
        >
          {present ? "Wygeneruj od nowa" : "Dodaj dane testowe"}
        </button>
      </div>
      {msg && <p className="hint">{msg}</p>}
    </section>
  );
}
