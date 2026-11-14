import { describe, expect, test } from 'vitest'
import { officialStreamHost, slotsFromProbe, TNT_ENTRIES } from './tnt-france'

describe('TNT France', () => {
  test('suit la numérotation Arcom de 1 à 25', () => {
    const numbers = TNT_ENTRIES.map((entry) => entry.number).filter((number): number is number => number !== null)
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25])
    expect(TNT_ENTRIES.find((entry) => entry.number === 8)?.name).toContain('LCP')
    expect(TNT_ENTRIES.find((entry) => entry.number === 4)?.name).toBe('France 4')
    expect(TNT_ENTRIES.every((entry) => entry.officialUrl.startsWith('https://'))).toBe(true)
  })

  test('refuse les restreams et ne garde qu’un HLS du diffuseur', () => {
    expect(officialStreamHost('http://149.62.177.107:9999/France_2/index.m3u8')).toBe(false)
    expect(officialStreamHost('https://freem3u.xyz/api/live/play.m3u8?vid=10007')).toBe(false)
    expect(officialStreamHost('https://raw.githubusercontent.com/Paradise-91/ParaTV/main/streams/canalplus/cnews-dm.m3u8')).toBe(false)
    expect(officialStreamHost('https://live-cdn-stream-euw1.bfmtv.bct.nextradiotv.com/master.m3u8')).toBe(true)
    const slots = slotsFromProbe([
      { id: 'bfm', streamUrl: 'https://live-cdn-stream-euw1.bfmtv.bct.nextradiotv.com/master.m3u8' },
      { id: 'france2', streamUrl: 'http://149.62.177.107:9999/France_2/index.m3u8' },
    ])
    expect(slots.find((slot) => slot.id === 'bfm')?.streamUrl).toContain('nextradiotv.com')
    expect(slots.find((slot) => slot.id === 'france2')?.streamUrl).toBeNull()
  })
})
