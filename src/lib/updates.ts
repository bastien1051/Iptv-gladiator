import { currentId, toast } from '../store'

const MARK = 'iptv-gladiator-updated'
const INTERVAL_MS = 30 * 60 * 1000

export function showAppliedUpdate(): void {
  try {
    if (sessionStorage.getItem(MARK) !== '1') return
    sessionStorage.removeItem(MARK)
  } catch {
    return
  }
  toast('Mise à jour appliquée')
}

export function watchUpdates(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const hadController = !!navigator.serviceWorker.controller
  let reloading = false
  let pending = false
  const reload = () => {
    if (reloading) return
    reloading = true
    try {
      sessionStorage.setItem(MARK, '1')
    } catch {
      /* navigation privée */
    }
    window.location.reload()
  }
  const apply = () => {
    if (!hadController) return
    pending = true
    if (!currentId.value) reload()
  }
  navigator.serviceWorker.addEventListener('controllerchange', apply)
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === 'sw-updated') apply()
  })
  window.setInterval(() => {
    if (pending && !currentId.value) reload()
  }, 1000)
  window.addEventListener('load', () => {
    const url = new URL('sw.js', document.baseURI)
    void navigator.serviceWorker.register(url).then((registration) => {
      const check = () => { void registration.update().catch(() => undefined) }
      check()
      window.setInterval(check, INTERVAL_MS)
    }).catch(() => undefined)
  })
}
