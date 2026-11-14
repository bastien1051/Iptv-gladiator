import { describe, expect, test } from 'vitest'
import {
  assessDevice,
  downsample,
  hasFrenchSubtitle,
  isFrenchLanguage,
  languageHint,
  readAutoSubPreference,
  shouldStartAutoSubs,
  usableCaption,
} from './auto-subs-policy'

describe('sous-titres français automatiques', () => {
  test('reconnaît le français dans les métadonnées', () => {
    expect(isFrenchLanguage('fr')).toBe(true)
    expect(isFrenchLanguage('fra')).toBe(true)
    expect(isFrenchLanguage('fr-FR')).toBe(true)
    expect(isFrenchLanguage('eng')).toBe(false)
    expect(isFrenchLanguage('')).toBe(false)
  })

  test('s’active tout seul si la langue n’est pas le français', () => {
    const subs = [{ lang: 'en', label: 'English' }]
    expect(shouldStartAutoSubs({ preference: 'auto', deviceOk: true, hint: 'en', subs })).toBe(true)
    expect(shouldStartAutoSubs({ preference: 'auto', deviceOk: true, hint: '', subs: [] })).toBe(true)
    expect(shouldStartAutoSubs({ preference: 'auto', deviceOk: true, hint: 'fra', subs: [] })).toBe(false)
    expect(shouldStartAutoSubs({ preference: 'auto', deviceOk: true, hint: 'en', subs: [{ lang: 'fr', label: 'Français' }] })).toBe(false)
    expect(shouldStartAutoSubs({ preference: 'off', deviceOk: true, hint: 'en', subs })).toBe(false)
    expect(shouldStartAutoSubs({ preference: 'on', deviceOk: true, hint: 'fr', subs: [] })).toBe(true)
    expect(shouldStartAutoSubs({ preference: 'auto', deviceOk: false, hint: 'en', subs })).toBe(false)
  })

  test('mémorise le choix et refuse les téléviseurs limités', () => {
    const memory = new Map<string, string>()
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value) },
    }
    expect(readAutoSubPreference(storage)).toBe('auto')
    storage.setItem('iptv-gladiator-auto-subs', 'off')
    expect(readAutoSubPreference(storage)).toBe('off')
    expect(assessDevice({ userAgent: 'Mozilla/5.0 (SMART-TV; Tizen 6.0)', hardwareConcurrency: 4, wasm: true }).ok).toBe(false)
    expect(assessDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', deviceMemory: 2, hardwareConcurrency: 8, wasm: true }).ok).toBe(false)
    expect(assessDevice({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', deviceMemory: 8, hardwareConcurrency: 8, wasm: true }).ok).toBe(true)
    expect(languageHint('', ['eng'])).toBe('eng')
    expect(hasFrenchSubtitle([{ lang: '', label: 'Français' }])).toBe(true)
  })

  test('rééchantillonne à 16 kHz et ignore les hallucinations', () => {
    const input = new Float32Array(480)
    input[10] = 1
    const out = downsample(input, 48000, 16000)
    expect(out.length).toBe(160)
    expect(usableCaption('  Bonjour le monde ')).toBe('Bonjour le monde')
    expect(usableCaption('Thanks for watching!')).toBe('')
    expect(usableCaption('…')).toBe('')
  })
})
