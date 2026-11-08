import type { Draft } from '../types'

/**
 * Flux 18+ officiels, gratuits, publiés par l’ayant droit, et vérifiés
 * (playlist HLS standard qui répond, pas une rediffusion d’une chaîne payante).
 * Contrôle du 8 novembre 2026 : aucun candidat n’a passé ce filtre.
 * iptv-org : index.nsfw.m3u en 404, categories/xxx.m3u vide.
 * Les listes communautaires qui reprennent des chaînes payantes ont été écartées.
 */
export const OFFICIAL_ADULT_DRAFTS: Draft[] = []
