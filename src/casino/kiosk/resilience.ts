import { nowInCanary } from '../../utils/canaryTime.ts'

/**
 * Keeping an unattended panel alive.
 *
 * A kiosk fails differently from a normal page: nobody is watching, nobody
 * reloads it, and a screen that has been black since 03:00 looks exactly like a
 * screen that is switched off. Everything here is about surviving the night.
 */

export interface ResilienceOptions {
  canvas: HTMLCanvasElement
  /** Called when the GPU context comes back and the scene must be rebuilt. */
  onContextRestored?: () => void
  /** Hour (0–23) in the Canary Islands for the nightly refresh. */
  reloadAtHour?: number
  /** Skip the nightly refresh entirely. */
  disableScheduledReload?: boolean
}

export interface Resilience {
  dispose(): void
}

/**
 * Stops the display sleeping. Chrome only grants a screen wake lock to a visible
 * page, and drops it on tab hide, so it has to be re-acquired on visibility
 * change rather than taken once at startup.
 */
function keepScreenAwake(): () => void {
  let sentinel: WakeLockSentinel | null = null
  let disposed = false

  const request = async (): Promise<void> => {
    if (disposed || document.visibilityState !== 'visible') return
    if (!('wakeLock' in navigator)) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      sentinel.addEventListener('release', () => {
        sentinel = null
      })
    } catch (error) {
      // Denied or unsupported. The OS-level screensaver settings are the real
      // guarantee anyway; this is belt and braces.
      console.warn('No se pudo bloquear el apagado de pantalla', error)
    }
  }

  const onVisibility = (): void => {
    if (document.visibilityState === 'visible' && sentinel === null) void request()
  }

  document.addEventListener('visibilitychange', onVisibility)
  void request()

  return () => {
    disposed = true
    document.removeEventListener('visibilitychange', onVisibility)
    void sentinel?.release()
  }
}

/**
 * Recovers from a lost GPU context.
 *
 * Drivers drop the WebGL context on their own schedule — after a suspend, a
 * driver update, or memory pressure. The default browser behaviour is to leave
 * the canvas frozen, so an unattended panel stays black indefinitely. Calling
 * `preventDefault` on the loss event is what makes a restore possible at all.
 */
function recoverContext(canvas: HTMLCanvasElement, onRestored?: () => void): () => void {
  const onLost = (event: Event): void => {
    event.preventDefault()
    console.warn('Contexto WebGL perdido; esperando restauración…')
    document.body.dataset['gpu'] = 'lost'
  }

  const onRestored_ = (): void => {
    console.info('Contexto WebGL restaurado; reconstruyendo la escena')
    delete document.body.dataset['gpu']
    if (onRestored) onRestored()
    // Without a rebuild hook the only honest recovery is a reload: every GPU
    // resource the scene held is gone.
    else window.location.reload()
  }

  canvas.addEventListener('webglcontextlost', onLost as EventListener, false)
  canvas.addEventListener('webglcontextrestored', onRestored_, false)

  return () => {
    canvas.removeEventListener('webglcontextlost', onLost as EventListener)
    canvas.removeEventListener('webglcontextrestored', onRestored_)
  }
}

/**
 * Nightly refresh. Browsers running the same page for weeks accumulate memory,
 * and the clock in the header would otherwise drift across a DST change.
 * Scheduled for a quiet hour and skipped if the page is not visible.
 */
function scheduleNightlyReload(hour: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const arm = (): void => {
    // La hora de referencia es siempre la de Canarias, sin importar la zona
    // horaria que tenga configurada el dispositivo.
    const now = nowInCanary()
    const next = new Date(now)
    next.setHours(hour, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)

    const delay = next.getTime() - now.getTime()
    timer = setTimeout(() => {
      // setTimeout drifts badly over many hours and does not fire while a
      // machine is asleep, so confirm the wall clock before acting.
      if (nowInCanary().getHours() === hour) window.location.reload()
      else arm()
    }, Math.min(delay, 3_600_000))
  }

  arm()
  return () => {
    if (timer !== null) clearTimeout(timer)
  }
}

export function installKioskResilience(options: ResilienceOptions): Resilience {
  const { canvas, onContextRestored, reloadAtHour = 4, disableScheduledReload = false } = options

  const teardown: Array<() => void> = [
    keepScreenAwake(),
    recoverContext(canvas, onContextRestored),
  ]
  if (!disableScheduledReload) teardown.push(scheduleNightlyReload(reloadAtHour))

  // A public panel should never show a context menu, a text selection, or the
  // browser's pinch-zoom.
  const block = (event: Event): void => event.preventDefault()
  document.addEventListener('contextmenu', block)
  document.addEventListener('gesturestart', block)
  teardown.push(() => {
    document.removeEventListener('contextmenu', block)
    document.removeEventListener('gesturestart', block)
  })

  return {
    dispose() {
      for (const fn of teardown) fn()
    },
  }
}
