import { Capacitor, registerPlugin } from '@capacitor/core'
import { signal } from '@preact/signals'

export const fullscreenOn = signal(false)

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: (keyboard?: number) => Promise<void> | void
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
let ignoreDismiss = false

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

const TV_UA = /smart-?tv|smarttv|bravia|web0s|webos|tizen|hbbtv|aft[a-z0-9]|android tv|googletv|chromecast|crkey|fire ?tv|netcast|maple|vidaa|viera|hisense|philipstv|whaletv|opera tv|omi\/|tv safari|shield android tv|mibox|mitv/i

export function televisionUserAgent(ua: string): boolean {
  return TV_UA.test(ua)
}

export function isTelevision(): boolean {
  if (typeof navigator !== 'undefined' && televisionUserAgent(navigator.userAgent)) return true
  if (typeof document === 'undefined') return false
  if (document.documentElement.getAttribute('data-tv') === '1') return true
  return document.querySelector('.shell[data-tv="1"]') != null
}

export function prefersImmersiveFill(): boolean {
  return isTelevision() || !fullscreenApiAvailable()
}

export function markTelevision(): void {
  if (isTelevision()) document.documentElement.setAttribute('data-tv', '1')
}

function fullscreenApiAvailable(): boolean {
  const root = document.documentElement as FullscreenElement
  return !!(root.requestFullscreen || root.webkitRequestFullscreen || root.webkitRequestFullScreen || root.mozRequestFullScreen || root.msRequestFullscreen)
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

function requestStageFullscreen(node: FullscreenElement): void {
  const keyboard = typeof Element !== 'undefined' && 'ALLOW_KEYBOARD_INPUT' in Element ? (Element as unknown as { ALLOW_KEYBOARD_INPUT: number }).ALLOW_KEYBOARD_INPUT : 1
  try {
    if (node.requestFullscreen) {
      const pending = node.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions)
      if (pending && typeof pending.catch === 'function') void pending.catch(() => undefined)
      return
    }
    if (node.webkitRequestFullscreen) {
      node.webkitRequestFullscreen(keyboard)
      return
    }
    node.webkitRequestFullScreen?.()
    node.mozRequestFullScreen?.()
    node.msRequestFullscreen?.()
  } catch {
    /* le repli CSS (position fixe, 100vw × 100vh) reste en place */
  }
}

export function silenceNativeControls(video: HTMLVideoElement): void {
  video.controls = false
  video.removeAttribute('controls')
  video.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback noplaybackrate')
  video.disablePictureInPicture = true
  video.setAttribute('disablepictureinpicture', '')
  video.setAttribute('disableremoteplayback', '')
  video.setAttribute('x-webkit-airplay', 'deny')
  video.setAttribute('playsinline', '')
  video.setAttribute('webkit-playsinline', '')
  const external = video.querySelector('track[data-external]')
  const tracks = video.textTracks
  for (let i = 0; i < tracks.length; i += 1) {
    const track = tracks[i]
    if (!track || track.kind === 'metadata') continue
    if (external && track === (external as HTMLTrackElement).track) continue
    track.mode = 'disabled'
  }
}

export function enterPlayerFullscreen(): void {
  const node = playerStage()
  if (!node) return
  fullscreenOn.value = true
  node.classList.add('is-fullscreen')
  if (prefersImmersiveFill()) node.classList.add('fill-screen')
  document.documentElement.classList.add('is-player-fullscreen')
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  const video = node.querySelector('video')
  if (video) silenceNativeControls(video)
  requestStageFullscreen(node)
  void nativeEnter()
}

export function exitPlayerFullscreen(): void {
  ignoreDismiss = true
  window.setTimeout(() => { ignoreDismiss = false }, 500)
  fullscreenOn.value = false
  document.documentElement.classList.remove('is-player-fullscreen')
  playerStage()?.classList.remove('is-fullscreen', 'fill-screen')
  const doc = document as FullscreenDocument
  try {
    const pending = document.exitFullscreen?.()
    if (pending && typeof pending.catch === 'function') void pending.catch(() => undefined)
    doc.webkitExitFullscreen?.()
    doc.mozCancelFullScreen?.()
    doc.msExitFullscreen?.()
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
    if (!apiWasActive) return
    apiWasActive = false
    const dismissed = !ignoreDismiss
    ignoreDismiss = false
    fullscreenOn.value = false
    document.documentElement.classList.remove('is-player-fullscreen')
    stage?.classList.remove('is-fullscreen', 'fill-screen')
    void nativeExit()
    if (dismissed) window.dispatchEvent(new CustomEvent('iptv-fullscreen-dismissed'))
  }
  document.addEventListener('fullscreenchange', sync)
  document.addEventListener('webkitfullscreenchange', sync)
  return () => {
    document.removeEventListener('fullscreenchange', sync)
    document.removeEventListener('webkitfullscreenchange', sync)
  }
}
