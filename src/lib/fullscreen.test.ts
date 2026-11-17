import { describe, expect, test } from 'vitest'
import { televisionUserAgent } from './fullscreen'

describe('détection télévision', () => {
  test('reconnaît les navigateurs de téléviseur et pas un ordinateur', () => {
    expect(televisionUserAgent('Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 Chrome/94.0 Safari/537.36')).toBe(true)
    expect(televisionUserAgent('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/79.0 Safari/537.36')).toBe(true)
    expect(televisionUserAgent('Mozilla/5.0 (Linux; Android 11; SHIELD Android TV) AppleWebKit/537.36 Chrome/94.0 Safari/537.36')).toBe(true)
    expect(televisionUserAgent('Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 Chrome/88.0 Safari/537.36')).toBe(true)
    expect(televisionUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36')).toBe(false)
    expect(televisionUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36')).toBe(false)
  })
})
