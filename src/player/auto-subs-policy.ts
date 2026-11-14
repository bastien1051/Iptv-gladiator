export type AutoSubPreference = 'auto' | 'on' | 'off'

export type DeviceSnapshot = {
  userAgent: string
  deviceMemory?: number
  hardwareConcurrency?: number
  wasm: boolean
}

export type SubHint = { lang: string; label: string }

const PREF_KEY = 'iptv-gladiator-auto-subs'

export function readAutoSubPreference(storage: Pick<Storage, 'getItem'> | null): AutoSubPreference {
  const value = storage?.getItem(PREF_KEY)
  if (value === 'on' || value === 'off' || value === 'auto') return value
  return 'auto'
}

export function writeAutoSubPreference(storage: Pick<Storage, 'setItem'> | null, value: AutoSubPreference): void {
  storage?.setItem(PREF_KEY, value)
}

export function isFrenchLanguage(value: string): boolean {
  const code = value.trim().toLowerCase().replace('_', '-')
  if (!code) return false
  return code === 'fr' || code.startsWith('fr-') || code === 'fra' || code === 'fre' || code.startsWith('french') || code.startsWith('français') || code.startsWith('francais')
}

export function hasFrenchSubtitle(subs: SubHint[]): boolean {
  return subs.some((track) => isFrenchLanguage(track.lang) || /fran[cç]/.test(track.label.toLowerCase()) || track.label.toLowerCase().includes('french'))
}

/** Channel metadata and the active audio track, used only as a hint before Whisper speaks. */
export function languageHint(audioLang: string, channelLangs: string[]): string {
  if (audioLang.trim()) return audioLang
  return channelLangs.find((item) => item.trim()) || ''
}

export function assessDevice(device: DeviceSnapshot): { ok: boolean; message: string } {
  if (/Smart-?TV|SmartTV|Tizen|Web0S|WebOS|BRAVIA|HbbTV|Android TV|GoogleTV|AFT[A-Z0-9]|Fire TV|CrKey|VIDAA|NetCast|Maple/i.test(device.userAgent)) {
    return { ok: false, message: 'Sous-titres auto désactivés sur ce téléviseur.' }
  }
  if (!device.wasm) return { ok: false, message: 'Sous-titres auto désactivés : WebAssembly indisponible.' }
  if (typeof device.deviceMemory === 'number' && device.deviceMemory > 0 && device.deviceMemory <= 2) {
    return { ok: false, message: 'Sous-titres auto désactivés : mémoire insuffisante.' }
  }
  if (typeof device.hardwareConcurrency === 'number' && device.hardwareConcurrency > 0 && device.hardwareConcurrency <= 2) {
    return { ok: false, message: 'Sous-titres auto désactivés : processeur trop limité.' }
  }
  return { ok: true, message: '' }
}

export function currentDevice(): DeviceSnapshot {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    userAgent: navigator.userAgent,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    wasm: typeof WebAssembly !== 'undefined',
  }
}

/**
 * Default is on whenever we do not already know the speech is French and no French subtitle
 * track is present. Whisper may later stop the session if it hears French.
 */
export function shouldStartAutoSubs(input: {
  preference: AutoSubPreference
  deviceOk: boolean
  hint: string
  subs: SubHint[]
}): boolean {
  if (!input.deviceOk || input.preference === 'off') return false
  if (input.preference === 'on') return true
  if (hasFrenchSubtitle(input.subs)) return false
  if (isFrenchLanguage(input.hint)) return false
  return true
}

export function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input
  const ratio = fromRate / toRate
  const length = Math.max(1, Math.floor(input.length / ratio))
  const out = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    const pos = i * ratio
    const left = Math.floor(pos)
    const right = Math.min(left + 1, input.length - 1)
    const mix = pos - left
    out[i] = input[left] * (1 - mix) + input[right] * mix
  }
  return out
}

export function peakAbs(input: Float32Array): number {
  let peak = 0
  for (let i = 0; i < input.length; i += 1) {
    const value = Math.abs(input[i])
    if (value > peak) peak = value
  }
  return peak
}

const HALLUCINATION = /sous[- ]titres?\s+(par|réalis)|thanks for watching|thank you for watching|please subscribe|amara\.org|sous-titres par la communauté|translated by/i

export function usableCaption(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length < 2) return ''
  if (HALLUCINATION.test(clean)) return ''
  if (/^[\s.…,!?\-–—]+$/.test(clean)) return ''
  return clean
}
