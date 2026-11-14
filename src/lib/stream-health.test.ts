import { describe, expect, test } from 'vitest'
import { catalogLabelReason, corsAllows, inspectManifest, isPaidService, prefilterUrl, shouldRetry } from './stream-health'

const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360
low/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
high/index.m3u8
`
const media = `#EXTM3U
#EXT-X-TARGETDURATION:6
#EXTINF:6.0,
https://cdn.example/segment-1.ts
#EXTINF:6.0,
https://cdn.example/segment-2.ts
`

describe('contrôle des flux', () => {
  test('retire le géoblocage, le hors 24/7 et les services payants', () => {
    expect(catalogLabelReason(['Geo-blocked'])).toBe('geo-blocked')
    expect(catalogLabelReason(['Not 24/7'])).toBe('not-24-7')
    expect(catalogLabelReason([])).toBeNull()
    expect(isPaidService('DAZN 1 (1080p)', 'https://cdn.example/a.m3u8')).toBe(true)
    expect(isPaidService('Canal+ Sport', 'https://cdn.example/a.m3u8')).toBe(true)
    expect(isPaidService('Sky News (720p)', 'https://cdn.example/a.m3u8')).toBe(false)
    expect(isPaidService('Canal 24 Horas', 'https://cdn.example/a.m3u8')).toBe(false)
    expect(isPaidService('Pluto TV Cinéma', 'https://service-stitcher.clusters.pluto.tv/stitch/hls/channel/abc/master.m3u8')).toBe(false)
    expect(prefilterUrl({ name: 'France 3', url: 'https://cdn.example/a.m3u8', labels: ['Geo-blocked'] })).toBe('geo-blocked')
    expect(prefilterUrl({ name: 'France 2', url: 'https://cdn.example/a.m3u8', labels: [] })).toBeNull()
  })

  test('reconnaît un manifeste HLS lisible et refuse le DRM', () => {
    const parsed = inspectManifest(master, 'https://cdn.example/playlist.m3u8')
    expect(parsed).toEqual({ ok: true, kind: 'master', next: 'https://cdn.example/low/index.m3u8' })
    const list = inspectManifest(media, 'https://cdn.example/live.m3u8')
    expect(list).toEqual({ ok: true, kind: 'media', next: 'https://cdn.example/segment-1.ts' })
    expect(inspectManifest('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://x"\n', 'https://cdn.example/a.m3u8').ok).toBe(false)
    expect(inspectManifest('<MPD><ContentProtection schemeIdUri="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"/></MPD>', 'https://cdn.example/a.mpd').ok).toBe(false)
    const dash = inspectManifest('<MPD><Period><AdaptationSet><Representation><SegmentTemplate media="seg-$Number$.m4s" startNumber="8"/></Representation></AdaptationSet></Period></MPD>', 'https://cdn.example/live.mpd')
    expect(dash).toEqual({ ok: true, kind: 'dash', next: 'https://cdn.example/seg-8.m4s' })
  })

  test('le CORS du site et les reprises', () => {
    expect(corsAllows('*')).toBe(true)
    expect(corsAllows('https://bastien1051.github.io')).toBe(true)
    expect(corsAllows(null)).toBe(false)
    expect(corsAllows('https://example.test')).toBe(false)
    expect(shouldRetry('timeout')).toBe(true)
    expect(shouldRetry('http')).toBe(false)
    expect(shouldRetry('drm')).toBe(false)
  })
})
