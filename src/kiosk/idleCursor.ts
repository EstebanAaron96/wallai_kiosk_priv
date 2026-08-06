const IDLE_MS = 5_000;
const IDLE_CLASS = 'kiosk-cursor-idle';

/**
 * Oculta el cursor tras IDLE_MS sin movimiento de ratón (pantalla de kiosco
 * sin interacción táctil ni de ratón real, pero que puede tener un ratón USB
 * conectado accidentalmente). Se reactiva con cualquier movimiento.
 */
export function setupIdleCursor(): () => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  const hide = () => document.body.classList.add(IDLE_CLASS);
  const show = () => {
    document.body.classList.remove(IDLE_CLASS);
    clearTimeout(timeoutId);
    timeoutId = setTimeout(hide, IDLE_MS);
  };

  window.addEventListener('mousemove', show);
  window.addEventListener('mousedown', show);
  timeoutId = setTimeout(hide, IDLE_MS);

  return () => {
    window.removeEventListener('mousemove', show);
    window.removeEventListener('mousedown', show);
    clearTimeout(timeoutId);
  };
}
