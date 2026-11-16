/**
 * Przycisk „×" pokazywany po najechaniu myszą na wpis — usuwa od razu, bez potwierdzenia (cofnięcie przez
 * powiadomienie). `span role=button`, bo siedzi w <button> wpisu. Zatrzymuje pointerdown/touchstart,
 * żeby nie zaczynać przeciągania, i click, żeby nie otwierać edycji.
 */
export function DelBtn({ onDelete }: { onDelete: () => void }) {
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label="Usuń wpis"
      title="Usuń"
      className="del-btn"
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
    >
      ×
    </span>
  );
}

/**
 * „P” po najechaniu na wpis: wstaw go w najbliższą wolną godzinę w godzinach produktywności (prefs.ts).
 * Włączone (`on`) — widać zawsze; ponowne kliknięcie wyłącza auto-planowanie.
 */
export function PlanBtn({ on, onPlan }: { on: boolean; onPlan: () => void }) {
  return (
    <span
      role="button"
      tabIndex={-1}
      aria-label={on ? "Wyłącz planowanie w godzinach produktywności" : "Zaplanuj w najbliższej wolnej godzinie"}
      aria-pressed={on}
      title={on ? "P: planowany w godzinach produktywności (kliknij, żeby wyłączyć)" : "P: najbliższa wolna godzina w godzinach produktywności"}
      className={`plan-btn${on ? " on" : ""}`}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onPlan();
      }}
    >
      P
    </span>
  );
}
