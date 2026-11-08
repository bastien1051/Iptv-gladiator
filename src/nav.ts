import { exitPlayerFullscreen, isPlayerFullscreen, togglePlayerFullscreen } from './lib/fullscreen'
import { phoneLayout } from './lib/phone'
import {
  back,
  closePlayer,
  currentId,
  hotkeys,
  moreOpen,
  multiHooks,
  numberEntry,
  playPrevious,
  query,
  view,
  zap,
  zapToNumber,
} from './store'

let timer = 0
let okTimer = 0
let suppressClick = false

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function moveFocus(direction: 'left' | 'right' | 'up' | 'down'): void {
  const nodes = [...document.querySelectorAll<HTMLElement>('[data-nav]')].filter((element) => {
    if (element.hasAttribute('disabled') || element.getAttribute('aria-hidden') === 'true') return false
    const rect = element.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
  })
  const current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (!current || !current.hasAttribute('data-nav')) {
    nodes[0]?.focus()
    return
  }
  const origin = current.getBoundingClientRect()
  const ox = origin.left + origin.width / 2
  const oy = origin.top + origin.height / 2
  let best: HTMLElement | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const node of nodes) {
    if (node === current) continue
    const rect = node.getBoundingClientRect()
    const dx = rect.left + rect.width / 2 - ox
    const dy = rect.top + rect.height / 2 - oy
    if (direction === 'left' && dx >= -8) continue
    if (direction === 'right' && dx <= 8) continue
    if (direction === 'up' && dy >= -8) continue
    if (direction === 'down' && dy <= 8) continue
    const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy)
    const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx)
    if (secondary > primary * 1.6 + 48) continue
    const score = primary + secondary * 2.2
    if (score < bestScore) {
      bestScore = score
      best = node
    }
  }
  if (best) {
    best.focus()
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

function isBackKey(event: KeyboardEvent): boolean {
  const key = event.key
  const code = event.keyCode || event.which
  return key === 'Escape' || key === 'Backspace' || key === 'XF86Back' || key === 'GoBack' || key === 'BrowserBack'
    || event.code === 'BrowserBack' || event.code === 'GoBack'
    || code === 461 || code === 10009
}

function arrowDirection(event: KeyboardEvent): 'left' | 'right' | 'up' | 'down' | null {
  const key = event.key
  const code = event.keyCode || event.which
  if (key === 'ArrowLeft' || key === 'Left' || code === 37) return 'left'
  if (key === 'ArrowRight' || key === 'Right' || code === 39) return 'right'
  if (key === 'ArrowUp' || key === 'Up' || code === 38) return 'up'
  if (key === 'ArrowDown' || key === 'Down' || code === 40) return 'down'
  return null
}

function onKey(event: KeyboardEvent): void {
  const target = event.target
  const typing = isTyping(target)
  const dialog = document.querySelector('dialog[open]')
  const key = event.key
  const code = event.keyCode || event.which

  if (isBackKey(event) && dialog instanceof HTMLDialogElement) {
    event.preventDefault()
    dialog.close()
    return
  }
  if (!typing && isBackKey(event)) {
    event.preventDefault()
    if (phoneLayout() && currentId.value) {
      closePlayer()
      return
    }
    if (isPlayerFullscreen()) {
      exitPlayerFullscreen()
      return
    }
    if (query.value && view.value !== 'adult') query.value = ''
    else back()
    return
  }
  if (!typing && (key === 'PageUp' || key === 'PageDown' || code === 427 || code === 428)) {
    event.preventDefault()
    const delta = key === 'PageUp' || code === 427 ? -1 : 1
    if (view.value === 'multi' && multiHooks.zap) multiHooks.zap(delta)
    else zap(delta)
    return
  }
  if (!typing && key === 'p' && !event.metaKey && !event.ctrlKey) {
    event.preventDefault()
    playPrevious()
    return
  }
  if (!typing && key === 'm') {
    event.preventDefault()
    hotkeys.mute()
    return
  }
  if (!typing && key === 'f') {
    event.preventDefault()
    togglePlayerFullscreen()
    return
  }
  if (!typing && (key === 'Enter' || code === 23) && !event.repeat && !numberEntry.value) {
    window.clearTimeout(okTimer)
    okTimer = window.setTimeout(() => {
      suppressClick = true
      togglePlayerFullscreen()
    }, 550)
  }
  if (!typing && key === 'i') {
    event.preventDefault()
    hotkeys.info()
    return
  }
  if (!typing && key === 'r') {
    event.preventDefault()
    hotkeys.record()
    return
  }
  if (!typing && /^[0-9]$/.test(key)) {
    event.preventDefault()
    numberEntry.value = `${numberEntry.value}${key}`.slice(0, 4)
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      const value = Number(numberEntry.value)
      numberEntry.value = ''
      if (value > 0) zapToNumber(value)
    }, 1200)
    return
  }
  if (!typing && key === 'Enter' && numberEntry.value) {
    event.preventDefault()
    const value = Number(numberEntry.value)
    numberEntry.value = ''
    window.clearTimeout(timer)
    if (value > 0) zapToNumber(value)
    return
  }

  const direction = arrowDirection(event)
  if (!direction) return
  if (typing && (direction === 'left' || direction === 'right')) return
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (!typing && active?.hasAttribute('data-row-index') && (direction === 'up' || direction === 'down')) {
    const index = Number(active.getAttribute('data-row-index'))
    const host = active.closest('[data-row-count]')
    const total = Number(host?.getAttribute('data-row-count') ?? 0)
    const next = index + (direction === 'down' ? 1 : -1)
    if (next >= 0 && next < total) {
      event.preventDefault()
      window.dispatchEvent(new CustomEvent('leposte-focus-row', { detail: next }))
      return
    }
  }
  event.preventDefault()
  moveFocus(direction)
}

function onKeyUp(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.keyCode === 23) window.clearTimeout(okTimer)
}

function onClickCapture(event: Event): void {
  if (!suppressClick) return
  suppressClick = false
  event.preventDefault()
  event.stopPropagation()
}

export function installNav(): () => void {
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('click', onClickCapture, true)
  return () => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('click', onClickCapture, true)
  }
}

export function closeMore(): void {
  moreOpen.value = false
}
