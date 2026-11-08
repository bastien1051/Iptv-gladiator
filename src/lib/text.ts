function displayNames(type: 'region' | 'language'): Intl.DisplayNames | null {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return null
    return new Intl.DisplayNames(['fr'], { type })
  } catch {
    return null
  }
}

const CATEGORY_FR: Record<string, string> = {
  auto: 'Auto',
  animation: 'Animation',
  business: 'Économie',
  classic: 'Classiques',
  comedy: 'Humour',
  cooking: 'Cuisine',
  culture: 'Culture',
  documentary: 'Documentaire',
  education: 'Éducation',
  entertainment: 'Divertissement',
  family: 'Famille',
  general: 'Généraliste',
  interactive: 'Interactif',
  kids: 'Jeunesse',
  legislative: 'Parlement',
  lifestyle: 'Art de vivre',
  movies: 'Films',
  music: 'Musique',
  news: 'Information',
  outdoor: 'Plein air',
  public: 'Public',
  relax: 'Détente',
  religious: 'Religions',
  science: 'Science',
  series: 'Séries',
  shop: 'Téléachat',
  sports: 'Sport',
  travel: 'Voyage',
  weather: 'Météo',
  xxx: 'Adulte',
  undefined: 'Autre',
}

const ISO3_TO_1: Record<string, string> = {
  fra: 'fr', fre: 'fr', eng: 'en', spa: 'es', rus: 'ru', por: 'pt', hin: 'hi', ara: 'ar', ita: 'it',
  deu: 'de', ger: 'de', zho: 'zh', chi: 'zh', nld: 'nl', dut: 'nl', fas: 'fa', per: 'fa', ron: 'ro',
  rum: 'ro', ukr: 'uk', tur: 'tr', ind: 'id', hun: 'hu', dan: 'da', pol: 'pl', swe: 'sv', jpn: 'ja',
  kor: 'ko', ell: 'el', gre: 'el', ces: 'cs', cze: 'cs', heb: 'he', tha: 'th', vie: 'vi', fin: 'fi',
  nor: 'no', nob: 'nb', cat: 'ca', srp: 'sr', hrv: 'hr', bul: 'bg', slk: 'sk', slo: 'sk', slv: 'sl',
  lit: 'lt', lav: 'lv', est: 'et', isl: 'is', gle: 'ga', cym: 'cy', wel: 'cy', eus: 'eu', baq: 'eu',
  glg: 'gl', msa: 'ms', may: 'ms', tam: 'ta', tel: 'te', ben: 'bn', urd: 'ur', swa: 'sw', afr: 'af',
  amh: 'am', hye: 'hy', arm: 'hy', kat: 'ka', geo: 'ka', kaz: 'kk', uzb: 'uz', aze: 'az', bel: 'be',
  mkd: 'mk', mac: 'mk', bos: 'bs', sqi: 'sq', alb: 'sq', mlt: 'mt', ltz: 'lb', fil: 'fil', tgl: 'tl',
  mya: 'my', bur: 'my', khm: 'km', lao: 'lo', sin: 'si', nep: 'ne', pus: 'ps', kur: 'ku', som: 'so',
  hau: 'ha', yor: 'yo', ibo: 'ig', zul: 'zu', xho: 'xh', mlg: 'mg', mon: 'mn', tib: 'bo', bod: 'bo',
  uig: 'ug', kir: 'ky', tgk: 'tg', tuk: 'tk', tat: 'tt', bak: 'ba', chv: 'cv', oss: 'os', abk: 'ab',
  san: 'sa', mar: 'mr', guj: 'gu', kan: 'kn', mal: 'ml', pan: 'pa', ori: 'or', asm: 'as', nno: 'nn',
  fao: 'fo', kal: 'kl', epo: 'eo', lat: 'la', grc: 'grc', arc: 'arc', cop: 'cop', syr: 'syr',
}

export function normName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(hd|sd|fhd|uhd|4k|1080p|720p|480p|576p|2160p|hevc|h265|hdr)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function hashString(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function categoryLabel(id: string): string {
  return CATEGORY_FR[id] ?? id
}

export function countryLabel(code: string): string {
  if (!code || code === 'INT') return 'International'
  try {
    return displayNames('region')?.of(code) || code
  } catch {
    return code
  }
}

export function languageLabel(code: string): string {
  const iso1 = ISO3_TO_1[code]
  if (!iso1) return code
  try {
    const label = displayNames('language')?.of(iso1)
    if (!label) return code
    return label.charAt(0).toLocaleUpperCase('fr') + label.slice(1)
  } catch {
    return code
  }
}

export function fastLabel(service: string): string {
  if (service === 'pluto') return 'Pluto TV'
  if (service === 'samsung') return 'Samsung TV Plus'
  if (service === 'plex') return 'Plex'
  if (service === 'rakuten') return 'Rakuten TV'
  if (service === 'roku') return 'Roku'
  return service
}

export function formatClock(ms: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(new Date(ms))
}

export function formatDay(ms: number): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  }).format(new Date(ms))
}

export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  if (h > 0) return `${h}:${mm}:${ss}`
  return `${mm}:${ss}`
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'Bonne nuit'
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export function slug(value: string): string {
  return normName(value).replace(/ /g, '-').slice(0, 60) || 'video'
}

export function parseDuration(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value.trim()) return undefined
  if (/^\d+$/.test(value.trim())) return Number(value.trim())
  const parts = value.split(':').map((part) => Number(part))
  if (parts.some((part) => Number.isNaN(part))) return undefined
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return undefined
}
