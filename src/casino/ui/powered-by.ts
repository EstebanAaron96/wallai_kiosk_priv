/**
 * Product credit under the 3D view.
 *
 * Sits on the page itself rather than in a chip: the WALL AI mark carries its own
 * blocks, and on the light background they read without any container fighting
 * them. The bottom band of the viewport stays clear even as the idle orbit moves
 * the model, so nothing collides with it.
 */
export function createPoweredBy(): HTMLElement {
  const element = document.createElement('div')
  element.className = 'powered-by'
  element.innerHTML = `
    <span class="powered-by__label">Powered by</span>
    <img src="/logos/wall-ai.png" alt="WALL AI" class="powered-by__mark" />`
  return element
}
