import { Capacitor, registerPlugin } from '@capacitor/core'
import { signal } from '@preact/signals'

export const fullscreenOn = signal(false)

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
  webkitRequestFullScreen?: () => void
  mozRequestFullScreen?: () => void
  msRequestFullscreen?: () => void
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
  mozCancelFullScreen?: () => void
  msExitFullscreen?: () => void
}

type ScreenPlugin = {
  enter: () => Promise<void>
  exit: () => Promise<void>
}

const nativeScreen = registerPlugin<ScreenPlugin>('GladiatorScreen')

export function playerStage(): FullscreenElement | null {
  return document.getElementById('player-stage') as FullscreenElement | null
}

function fullscreenNode(): Element | null {
  const doc = document as FullscreenDocument
  return document.fullscreenElement || doc.webkitFullscreenElement || null
}

export function isPlayerFullscreen(): boolean {
  const stage = playerStage()
  return fullscreenOn.value || (!!stage && fullscreenNode() === stage)
}

export function prefersImmersiveFill(): boolean {
  const ua = navigator.userAgent
  if (/SmartTV|Smart-TV|BRAVIA|Web0S|Tizen|AFT|AFTT|Android TV|HbbTV|CrKey|Fire TV|TV Safari/i.test(ua)) return true
  return document.documentElement.getAttribute('data-tv') === '1'
}

async function nativeEnter(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await nativeScreen.enter()
  } catch {
    /* le plein écran web reste actif */
  }
}

async function nativeExit(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await nativeScreen.exit()
  } catch {
    /* ignore */
  }
}

export function enterPlayerFullscreen(): void {
  const node = playerStage()
  if (!node) return
  fullscreenOn.value = true
  node.classList.add('is-fullscreen')
  if (prefersImmersiveFill() || Capacitor.isNativePlatform()) node.classList.add('fill-screen')
  const request = node.requestFullscreen?.bind(node)
    ?? node.webkitRequestFullscreen?.bind(node)
    ?? node.webkitRequestFullScreen?.bind(node)
    ?? node.mozRequestFullScreen?.bind(node)
    ?? node.msRequestFullscreen?.bind(node)
  try {
    const pending = request?.()
    if (pending && typeof (pending as Promise<void>).catch === 'function') {
      void (pending as Promise<void>).catch(() => undefined)
    }
  } catch {
    /* certains navigateurs de téléviseur refusent l’API */
  }
  void nativeEnter()
}

export function exitPlayerFullscreen(): void {
  fullscreenOn.value = false
  playerStage()?.classList.remove('is-fullscreen', 'fill-screen')
  const doc = document as FullscreenDocument
  try {
    if (fullscreenNode()) {
      const pending = document.exitFullscreen?.()
      if (pending && typeof pending.catch === 'function') void pending.catch(() => undefined)
      doc.webkitExitFullscreen?.()
      doc.mozCancelFullScreen?.()
      doc.msExitFullscreen?.()
    }
  } catch {
    /* ignore */
  }
  void nativeExit()
}

export function togglePlayerFullscreen(): void {
  if (isPlayerFullscreen()) exitPlayerFullscreen()
  else enterPlayerFullscreen()
}

export function installFullscreenSync(): () => void {
  let apiWasActive = false
  const sync = () => {
    const stage = playerStage()
    const active = !!stage && fullscreenNode() === stage
    if (active) {
      apiWasActive = true
      return
    }
    // Ne pas retirer le plein écran CSS si l’API a été refusée (navigateurs Tizen).
    if (apiWasActive && fullscreenOn.value && !stage?.classList.contains('fill-screen')) {
      apiWasActive = false
      fullscreenOn.value = false
      stage?.classList.remove('is-fullscreen')
      void nativeExit()
    }
  }
  document.addEventListener('fullscreenchange', sync)
  document.addEventListener('webkitfullscreenchange', sync)
  return () => {
    document.removeEventListener('fullscreenchange', sync)
    document.removeEventListener('webkitfullscreenchange', sync)
  }
}
