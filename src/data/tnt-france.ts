export type TntEntry = {
  id: string
  number: number | null
  name: string
  officialUrl: string
  streams: string[]
}

/** Hosts that belong to the broadcaster. Anything else is treated as a restream and never played. */
const OFFICIAL_HOSTS = ['bfmtv.bct.nextradiotv.com', 'bfmb.bct.nextradiotv.com']

export function officialStreamHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false
    return OFFICIAL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

/**
 * Numérotation Arcom en vigueur depuis le 6 juin 2025.
 * Canal 26 (Paris Première) est payant et n’est pas listé.
 * Les adresses `streams` sont des HLS publiés par le diffuseur ; le contrôle
 * de santé du build ne garde une adresse que si elle répond.
 */
export const TNT_ENTRIES: TntEntry[] = [
  { id: 'tf1', number: 1, name: 'TF1', officialUrl: 'https://www.tf1.fr/tf1/direct', streams: [] },
  { id: 'france2', number: 2, name: 'France 2', officialUrl: 'https://www.france.tv/france-2/direct.html', streams: [] },
  { id: 'france3', number: 3, name: 'France 3', officialUrl: 'https://www.france.tv/france-3/direct.html', streams: [] },
  { id: 'france4', number: 4, name: 'France 4', officialUrl: 'https://www.france.tv/france-4/direct.html', streams: [] },
  { id: 'france5', number: 5, name: 'France 5', officialUrl: 'https://www.france.tv/france-5/direct.html', streams: [] },
  { id: 'm6', number: 6, name: 'M6', officialUrl: 'https://www.m6.fr/m6', streams: [] },
  { id: 'arte', number: 7, name: 'Arte', officialUrl: 'https://www.arte.tv/fr/direct/', streams: [] },
  { id: 'lcp', number: 8, name: 'LCP – Public Sénat', officialUrl: 'https://lcp.fr/', streams: [] },
  { id: 'w9', number: 9, name: 'W9', officialUrl: 'https://www.m6.fr/w9', streams: [] },
  { id: 'tmc', number: 10, name: 'TMC', officialUrl: 'https://www.tf1.fr/tmc/direct', streams: [] },
  { id: 'tfx', number: 11, name: 'TFX', officialUrl: 'https://www.tf1.fr/tfx/direct', streams: [] },
  { id: 'gulli', number: 12, name: 'Gulli', officialUrl: 'https://www.m6.fr/gulli', streams: [] },
  { id: 'bfm', number: 13, name: 'BFMTV', officialUrl: 'https://www.bfmtv.com/en-direct/', streams: ['https://live-cdn-stream-euw1.bfmtv.bct.nextradiotv.com/master.m3u8'] },
  { id: 'cnews', number: 14, name: 'CNews', officialUrl: 'https://www.cnews.fr/direct', streams: [] },
  { id: 'lci', number: 15, name: 'LCI', officialUrl: 'https://www.tf1.fr/lci', streams: [] },
  { id: 'franceinfo', number: 16, name: 'franceinfo', officialUrl: 'https://www.franceinfo.fr/en-direct/', streams: [] },
  { id: 'cstar', number: 17, name: 'CStar', officialUrl: 'https://www.canalplus.com/chaines/cstar', streams: [] },
  { id: 't18', number: 18, name: 'T18', officialUrl: 'https://t18.fr/', streams: [] },
  { id: 'novo19', number: 19, name: 'NOVO19', officialUrl: 'https://novo19.ouest-france.fr/Direct', streams: [] },
  { id: 'tf1series', number: 20, name: 'TF1 Séries Films', officialUrl: 'https://www.tf1.fr/tf1-series-films/direct', streams: [] },
  { id: 'lequipe', number: 21, name: "L'Équipe", officialUrl: 'https://www.lequipe.fr/', streams: [] },
  { id: '6ter', number: 22, name: '6ter', officialUrl: 'https://www.m6.fr/6ter', streams: [] },
  { id: 'rmcstory', number: 23, name: 'RMC Story', officialUrl: 'https://www.rmcplus.fr/direct/rmc_story', streams: [] },
  { id: 'rmcdecouverte', number: 24, name: 'RMC Découverte', officialUrl: 'https://www.rmcplus.fr/direct/rmc_decouverte', streams: [] },
  { id: 'rmclife', number: 25, name: 'RMC Life (ex-Chérie 25)', officialUrl: 'https://www.rmcplus.fr/direct/rmc_life', streams: [] },
  { id: 'france3-regions', number: null, name: 'France 3 régions', officialUrl: 'https://www.france.tv/france-3/', streams: [] },
  { id: 'france24', number: null, name: 'France 24', officialUrl: 'https://www.france24.com/fr/direct', streams: [] },
  { id: 'bfm-business', number: null, name: 'BFM Business', officialUrl: 'https://www.bfmtv.com/economie/', streams: ['https://live-cdn-stream-euw1.bfmb.bct.nextradiotv.com/master.m3u8'] },
  { id: 'bfm-lyon', number: null, name: 'BFM Lyon', officialUrl: 'https://www.bfmtv.com/lyon/', streams: ['https://live-cdn-bfmtvlyo-euw1.bfmtv.bct.nextradiotv.com/master.m3u8'] },
]

export type TntSlot = {
  id: string
  number: number | null
  name: string
  officialUrl: string
  streamUrl: string | null
}

export function slotsFromProbe(confirmed: { id: string; streamUrl: string | null }[]): TntSlot[] {
  const byId = new Map(confirmed.map((item) => [item.id, item.streamUrl]))
  return TNT_ENTRIES.map((entry) => {
    const chosen = byId.get(entry.id)
    const streamUrl = chosen && officialStreamHost(chosen) ? chosen : null
    return { id: entry.id, number: entry.number, name: entry.name, officialUrl: entry.officialUrl, streamUrl }
  })
}
