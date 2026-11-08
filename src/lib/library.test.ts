import { describe, expect, test } from 'vitest'
import { filterChannels } from './browse'
import { isAdultChannel, isCombat } from './classify'
import { finalize, parseM3u, playlistProblem } from './m3u'
import { detectStreamKind } from './stream'
import { parseXmltv, parseXmltvDate } from './xmltv'
import { liveStreamUrl, movieStreamUrl, normalizeBase, xtreamFromUrl } from './xtream'
import type { Channel } from '../types'

const playlist = `#EXTM3U
#EXTINF:-1 tvg-id="TVSBoxing.us@SD" tvg-logo="http://img/box.png" group-title="Sports",TVS Boxing (360p)
http://example.test/boxing.m3u8
#EXTINF:-1 tvg-id="Cuisine.fr@SD" group-title="Cooking",Cuisine TV
https://example.test/cuisine.m3u8
#EXTINF:-1 tvg-id="AdultSwim.us@SD" group-title="Animation",Adult Swim
https://example.test/swim.m3u8
#EXTINF:-1 tvg-id="Night.xx@SD" group-title="Adulte",Night Show
https://example.test/night.m3u8
#EXTINF:-1 tvg-id="FightNet.us@HD" group-title="Sports",Fight Network (1080p)
https://example.test/fight.m3u8
#EXTINF:-1 tvg-id="PlutoCine.fr@FR" group-title="Movies",Cine by Pluto TV
https://example.test/pluto.m3u8
`

function sample(partial: Partial<Channel> & Pick<Channel, 'id' | 'name'>): Channel {
  return {
    urls: [{ url: 'https://example.test/a.m3u8', quality: 1 }],
    languages: [],
    categories: [],
    adult: false,
    combat: false,
    searchBlob: partial.name.toLowerCase(),
    sourceId: 'test',
    ...partial,
  }
}

describe('listes et classement', () => {
  test('signale une réponse HTML ou vide à la place d’une liste', () => {
    expect(playlistProblem('')).toMatch(/Parse/)
    expect(playlistProblem('<html><body>interdit</body></html>')).toMatch(/HTML/)
    expect(playlistProblem(playlist)).toBeNull()
  })

  test('analyse une liste M3U et sépare les chaînes adultes', () => {
    const drafts = parseM3u(playlist, { id: 'fixture', role: 'full' })
    expect(drafts).toHaveLength(6)
    const { channels, adult } = finalize(drafts, true)
    expect(channels.some((channel) => channel.name.includes('TVS Boxing'))).toBe(true)
    expect(channels.some((channel) => channel.name.includes('Adult Swim'))).toBe(true)
    expect(adult.map((channel) => channel.name)).toContain('Night Show')
    expect(channels.some((channel) => channel.adult)).toBe(false)
    const boxing = channels.find((channel) => channel.name.includes('Boxing'))
    expect(boxing?.combat).toBe(true)
    expect(boxing?.categories).toContain('sports')
    expect(boxing?.country).toBe('US')
    const pluto = channels.find((channel) => channel.name.includes('Pluto'))
    expect(pluto?.fast).toBe('pluto')
  })

  test('une source adulte marque toutes ses chaînes', () => {
    const drafts = parseM3u('#EXTM3U\n#EXTINF:-1,Chaine\nhttps://example.test/a.m3u8\n', { id: 'org-nsfw', role: 'adult' })
    const { channels, adult } = finalize(drafts, true)
    expect(channels).toHaveLength(0)
    expect(adult).toHaveLength(1)
    expect(adult[0]?.adult).toBe(true)
  })

  test('les mots de combat et Adult Swim', () => {
    expect(isCombat('Glory Kickboxing Poland', 'Sports', ['sports'])).toBe(true)
    expect(isCombat('Cuisine TV', 'Cooking', ['cooking'])).toBe(false)
    expect(isAdultChannel('Adult Swim', 'Animation', ['animation'], false)).toBe(false)
    expect(isAdultChannel('Night', 'XXX', ['xxx'], false)).toBe(true)
  })

  test('la recherche et l’accueil ignorent les chaînes adultes', () => {
    const safe = sample({ id: 'a', name: 'Sport une', categories: ['sports'], searchBlob: 'sport une' })
    const hiddenAdult = sample({ id: 'b', name: 'Secret', adult: true, searchBlob: 'secret sport' })
    const found = filterChannels({
      channels: [safe],
      adult: [hiddenAdult],
      includeAdult: false,
      shelf: 'all',
      groupBy: 'country',
      group: 'ALL',
      query: 'sport',
      hidden: [],
      dead: [],
      hideDead: true,
      favorites: [],
      recents: [],
    })
    expect(found.map((channel) => channel.id)).toEqual(['a'])
    const sport = filterChannels({
      channels: [safe],
      adult: [hiddenAdult],
      includeAdult: false,
      shelf: 'sport',
      groupBy: 'country',
      group: 'ALL',
      query: '',
      hidden: [],
      dead: [],
      hideDead: true,
      favorites: [],
      recents: [],
    })
    expect(sport).toHaveLength(1)
  })
})

describe('guide, flux et xtream', () => {
  test('lit une date XMLTV et un programme', () => {
    expect(parseXmltvDate('20261108121415 +0000')).toBe(Date.UTC(2026, 10, 8, 12, 14, 15))
    const map = parseXmltv(`<?xml version="1.0"?><tv>
      <channel id="FR1"><display-name>France Info</display-name></channel>
      <programme start="20261108120000 +0000" stop="20261108130000 +0000" channel="FR1"><title>Journal</title><desc>Edition</desc></programme>
    </tv>`, Date.UTC(2026, 10, 8, 12, 30, 0))
    expect(map['id:fr1']?.[0]?.title).toBe('Journal')
    expect(map['name:france info']?.[0]?.desc).toBe('Edition')
  })

  test('reconnaît le type de flux et les adresses Xtream', () => {
    expect(detectStreamKind('https://cdn/live/index.m3u8', 'live')).toBe('hls')
    expect(detectStreamKind('https://cdn/stream.mpd', 'live')).toBe('dash')
    expect(detectStreamKind('https://cdn/live.ts', 'live')).toBe('mpegts')
    expect(detectStreamKind('https://cdn/movie.mp4', 'vod')).toBe('native')
    const auth = xtreamFromUrl('http://127.0.0.1:8080/get.php?username=ada&password=secret&type=m3u_plus')
    expect(auth?.username).toBe('ada')
    expect(normalizeBase('http://127.0.0.1:8080/player_api.php')).toBe('http://127.0.0.1:8080')
    expect(liveStreamUrl(auth!, 12)).toContain('/live/ada/secret/12.m3u8')
    expect(movieStreamUrl(auth!, 4, 'mkv')).toContain('/movie/ada/secret/4.mkv')
  })
})

test('live: la liste iptv-org s’analyse', async () => {
  const response = await fetch('https://iptv-org.github.io/iptv/index.m3u')
  expect(response.ok).toBe(true)
  const text = await response.text()
  const drafts = parseM3u(text, { id: 'org-index', role: 'full' })
  expect(drafts.length).toBeGreaterThan(5000)
  const { channels, adult } = finalize(drafts, true)
  expect(channels.length).toBeGreaterThan(4000)
  expect(adult).toHaveLength(0)
  expect(channels.some((channel) => channel.categories.includes('sports'))).toBe(true)
  expect(channels.some((channel) => channel.combat)).toBe(true)
  expect(channels.some((channel) => channel.fast === 'pluto')).toBe(true)
  const sports = await fetch('https://iptv-org.github.io/iptv/categories/sports.m3u')
  expect(sports.ok).toBe(true)
  const sportDrafts = parseM3u(await sports.text(), { id: 'org-sports', role: 'category' })
  expect(sportDrafts.length).toBeGreaterThan(100)
})
