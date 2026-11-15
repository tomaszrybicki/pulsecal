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
