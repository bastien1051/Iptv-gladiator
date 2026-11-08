import type { FastService } from '../types'
import { normName } from './text'

const COMBAT =
  /\b(boxe|boxing|mma|ufc|catch|wrestling|wwe|aew|lucha|kickboxing|kick boxing|muay|savate|bellator|pancrace|full contact)\b/

export function isCombat(name: string, groups: string, categories: string[]): boolean {
  const blob = normName(`${name} ${groups}`)
  if (COMBAT.test(blob)) return true
  const sport = categories.includes('sports') || /\bsport/.test(normName(groups))
  if (sport && /\b(fight|fighting|combat|kick)\b/.test(blob)) return true
  return false
}

export function isAdultChannel(name: string, groups: string, categories: string[], sourceAdult: boolean): boolean {
  const normalized = normName(name)
  if (normalized.includes('adult swim')) return false
  if (sourceAdult) return true
  if (categories.includes('xxx')) return true
  const blob = normName(`${name} ${groups}`)
  if (/\b(xxx|porn|porno|nsfw|erotique)\b/.test(blob)) return true
  if (/\b(adulte|adult)\b/.test(normName(groups))) return true
  return false
}

export function detectFast(name: string, tvgId: string, url: string): FastService | undefined {
  const blob = `${name} ${tvgId} ${url}`.toLowerCase()
  if (blob.includes('pluto')) return 'pluto'
  if (blob.includes('rakuten')) return 'rakuten'
  if (blob.includes('samsung')) return 'samsung'
  if (blob.includes('plex.wurl') || blob.includes('.plex.') || blob.includes('plex tv')) return 'plex'
  if (blob.includes('roku')) return 'roku'
  return undefined
}
