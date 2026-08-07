import { formatDate, formatTime } from './format.ts'

export interface Header {
  element: HTMLElement
  dispose(): void
}

export interface HeaderOptions {
  title: string
  subtitle?: string
}

/**
 * Top bar: client mark on the left, plant title in the middle, product mark and
 * clock on the right.
 *
 * The Kível wordmark ships solid black on transparent, so it is inverted to white
 * in CSS rather than shipping a second asset — the manual forbids recolouring the
 * mark itself, and a straight inversion to white is one of its allowed versions.
 * The WALL AI mark is not here: boxed on the carbon bar it needed a white chip
 * that fought the header, so it sits at the foot of the panel instead, straight
 * on the light page where its own blocks read on their own.
 */
export function createHeader({ title, subtitle }: HeaderOptions): Header {
  const element = document.createElement('header')
  element.className = 'topbar'

  element.innerHTML = `
    <div class="topbar__brand topbar__brand--client">
      <img src="/logos/kivel.png" alt="Kível" class="topbar__logo topbar__logo--invert" />
    </div>

    <div class="topbar__titles">
      <h1 class="topbar__title">${title}</h1>
      ${subtitle ? `<p class="topbar__subtitle">${subtitle}</p>` : ''}
    </div>

    <div class="topbar__meta">
      <div class="topbar__clock">
        <span class="topbar__time"></span>
        <span class="topbar__date"></span>
      </div>
      <img src="/logos/isotipo.png" alt="" class="topbar__isotipo topbar__logo--invert" />
    </div>`

  const timeNode = element.querySelector<HTMLElement>('.topbar__time')!
  const dateNode = element.querySelector<HTMLElement>('.topbar__date')!

  function tick(): void {
    const now = new Date()
    timeNode.textContent = formatTime(now)
    dateNode.textContent = formatDate(now)
  }

  tick()
  const timer = setInterval(tick, 15_000)

  return {
    element,
    dispose: () => clearInterval(timer),
  }
}
