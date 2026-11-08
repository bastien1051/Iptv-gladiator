import Hls from 'hls.js'
import type { Playable, QualityLevel, TrackChoice } from '../types'
import { detectStreamKind } from '../lib/stream'
import { toVtt } from '../lib/subs'

type SettingsSlice = { bufferSec: number; qualityCap: number }

type ShakaTrack = {
  id: number
  height?: number | null
  active?: boolean
  language?: string
  bandwidth?: number
  label?: string | null
}

type ShakaPlayer = {
  attach?: (el: HTMLVideoElement) => Promise<void>
  load: (url: string, startTime?: number | null) => Promise<unknown>
  destroy: () => Promise<void>
  configure: (config: unknown) => void
  getVariantTracks: () => ShakaTrack[]
  selectVariantTrack: (track: ShakaTrack, clearBuffer?: boolean) => void
  getAudioTracks?: () => ShakaTrack[]
  selectAudioTrack?: (id: number) => void
  getTextTracks: () => ShakaTrack[]
  selectTextTrack: (track: ShakaTrack | null) => void
  setTextTrackVisibility: (on: boolean) => void
  addEventListener: (type: string, fn: (event: { detail?: { message?: string } }) => void) => void
}

type ShakaNs = {
  Player: {
    new (media?: HTMLMediaElement | null): ShakaPlayer
    isBrowserSupported: () => boolean
  }
  polyfill: { installAll: () => void }
}

type MpegtsPlayer = {
  attachMediaElement: (el: HTMLVideoElement) => void
  load: () => void
  unload?: () => void
  play: () => void
  destroy: () => void
  on: (event: string, cb: () => void) => void
}

export type EngineHandlers = {
  onStatus: (text: string) => void
  onFatal: (message: string) => void
  onLevels: (levels: QualityLevel[], current: number) => void
  onAudio: (tracks: TrackChoice[], current: number) => void
  onSubs: (tracks: TrackChoice[], current: number) => void
  onTime: (position: number, duration: number) => void
  onPlaying: () => void
  onNeedGesture: () => void
}

async function loadShaka(): Promise<ShakaNs> {
  const mod = (await import('shaka-player/dist/shaka-player.compiled.js')) as Partial<ShakaNs> & { default?: Partial<ShakaNs> }
  const candidate = (mod.Player ? mod : mod.default) as ShakaNs | undefined
  if (candidate?.Player) return candidate
  const globalShaka = (globalThis as unknown as { shaka?: ShakaNs }).shaka
  if (!globalShaka?.Player) throw new Error('Lecteur DASH indisponible')
  return globalShaka
}

export class Engine {
  private video: HTMLVideoElement
  private settings: () => SettingsSlice
  private handlers: EngineHandlers
  private token = 0
  private hls: Hls | null = null
  private shaka: ShakaPlayer | null = null
  private mpegts: MpegtsPlayer | null = null
  private backend: 'hls' | 'dash' | 'ts' | 'native' | 'none' = 'none'
  private item: Playable | null = null
  private urlIndex = 0
  private retryCount = 0
  private retryTimer = 0
  private watchTimer = 0
  private lastTime = 0
  private stall = 0
  private frenchDone = false
  private mediaRecovered = false
  private destroyed = false
  private retrying = false

  constructor(video: HTMLVideoElement, settings: () => SettingsSlice, handlers: EngineHandlers) {
    this.video = video
    this.settings = settings
    this.handlers = handlers
    this.video.addEventListener('playing', this.onPlaying)
    this.video.addEventListener('timeupdate', this.onTime)
    this.video.addEventListener('error', this.onVideoError)
    this.watchTimer = window.setInterval(this.watch, 2000)
  }

  load(item: Playable): void {
    this.token += 1
    const token = this.token
    this.item = item
    this.urlIndex = 0
    this.retryCount = 0
    this.stall = 0
    this.frenchDone = false
    this.mediaRecovered = false
    this.handlers.onStatus('Connexion…')
    this.handlers.onLevels([], -1)
    this.handlers.onAudio([], -1)
    this.handlers.onSubs([], -1)
    void this.attach(token)
  }

  stop(): void {
    this.token += 1
    this.item = null
    window.clearTimeout(this.retryTimer)
    this.destroyBackends()
    this.video.pause()
  }

  destroy(): void {
    this.destroyed = true
    this.stop()
    window.clearInterval(this.watchTimer)
    this.video.removeEventListener('playing', this.onPlaying)
    this.video.removeEventListener('timeupdate', this.onTime)
    this.video.removeEventListener('error', this.onVideoError)
  }

  setQuality(index: number): void {
    if (!this.hls) return
    this.hls.currentLevel = index
    this.emitHlsLevels()
  }

  setAudio(index: number): void {
    if (this.hls) {
      this.hls.audioTrack = index
      this.emitHlsAudio()
      return
    }
    const tracks = this.shaka?.getAudioTracks?.() ?? []
    const track = tracks[index]
    if (track && this.shaka?.selectAudioTrack) this.shaka.selectAudioTrack(track.id)
  }

  setSub(index: number): void {
    if (this.hls) {
      this.hls.subtitleTrack = index
      this.emitHlsSubs()
      return
    }
    if (!this.shaka) {
      const tracks = this.video.textTracks
      for (let i = 0; i < tracks.length; i += 1) tracks[i].mode = i === index ? 'showing' : 'disabled'
      return
    }
    const tracks = this.shaka.getTextTracks()
    if (index < 0) {
      this.shaka.setTextTrackVisibility(false)
      return
    }
    const track = tracks[index]
    if (!track) return
    this.shaka.selectTextTrack(track)
    this.shaka.setTextTrackVisibility(true)
  }

  addSubtitleText(text: string, label: string): void {
    const vtt = toVtt(text)
    const blob = new Blob([vtt], { type: 'text/vtt' })
    const url = URL.createObjectURL(blob)
    this.video.querySelectorAll('track[data-external]').forEach((node) => node.remove())
    const track = document.createElement('track')
    track.kind = 'subtitles'
    track.label = label || 'Fichier'
    track.srclang = 'fr'
    track.src = url
    track.default = true
    track.dataset.external = '1'
    this.video.appendChild(track)
    track.track.mode = 'showing'
    this.handlers.onStatus('Sous-titres du fichier activés')
  }

  private onPlaying = (): void => {
    this.handlers.onPlaying()
    this.handlers.onStatus('')
  }

  private onTime = (): void => {
    const duration = Number.isFinite(this.video.duration) ? this.video.duration : 0
    this.handlers.onTime(this.video.currentTime || 0, duration)
  }

  private onVideoError = (): void => {
    if (this.backend !== 'native') return
    this.scheduleRetry('Le navigateur ne peut pas lire ce flux.', this.token)
  }

  private watch = (): void => {
    if (!this.item || this.video.paused || this.video.ended || this.video.seeking || this.video.readyState < 2) {
      this.lastTime = this.video.currentTime
      this.stall = 0
      return
    }
    if (Math.abs(this.video.currentTime - this.lastTime) < 0.25) {
      this.stall += 1
      if (this.stall === 4) {
        this.handlers.onStatus('Image figée, tentative de reprise…')
        this.recover()
      } else if (this.stall >= 8) {
        this.scheduleRetry('La lecture est restée figée.', this.token)
      }
    } else {
      this.stall = 0
      this.lastTime = this.video.currentTime
    }
  }

  private recover(): void {
    try {
      if (this.hls) {
        this.hls.recoverMediaError()
        return
      }
      if (this.mpegts) {
        this.mpegts.unload?.()
        this.mpegts.load()
        this.mpegts.play()
        return
      }
    } catch {
      /* reprise plus bas */
    }
    this.scheduleRetry('Reprise impossible.', this.token)
  }

  private scheduleRetry(message: string, token: number): void {
    if (this.destroyed || token !== this.token || !this.item || this.retrying) return
    this.retrying = true
    this.retryCount += 1
    if (this.retryCount === 2 && this.urlIndex + 1 < this.item.urls.length) {
      this.urlIndex += 1
      this.retryCount = 0
      this.retrying = false
      this.handlers.onStatus('Essai d’une autre adresse…')
      void this.attach(token)
      return
    }
    if (this.retryCount > 5) {
      this.retrying = false
      this.handlers.onFatal(message || 'Lecture impossible.')
      return
    }
    const delay = Math.min(16000, 1000 * 2 ** (this.retryCount - 1))
    this.handlers.onStatus(`Reconnexion dans ${Math.round(delay / 1000)} s…`)
    window.clearTimeout(this.retryTimer)
    this.retryTimer = window.setTimeout(() => {
      this.retrying = false
      if (token === this.token) void this.attach(token)
    }, delay)
  }

  private async attach(token: number): Promise<void> {
    this.destroyBackends()
    if (token !== this.token || !this.item) return
    const stream = this.item.urls[this.urlIndex]
    if (!stream) {
      this.handlers.onFatal('Aucune adresse de flux.')
      return
    }
    const mode = detectStreamKind(stream.url, this.item.kind)
    try {
      if (mode === 'hls') await this.playHls(stream.url, token)
      else if (mode === 'dash') await this.playDash(stream.url, token)
      else if (mode === 'mpegts' || mode === 'flv') await this.playTs(stream.url, mode, token)
      else this.playNative(stream.url, token)
      this.tryPlay()
    } catch (error) {
      if (token !== this.token) return
      const message = error instanceof Error ? error.message : 'Lecture impossible.'
      this.scheduleRetry(message, token)
    }
  }

  private tryPlay(): void {
    const start = this.item?.startAt
    if (start && start > 1 && this.backend !== 'hls') {
      const seek = () => {
        if (Number.isFinite(this.video.duration) || this.video.readyState >= 1) this.video.currentTime = start
      }
      this.video.addEventListener('loadedmetadata', seek, { once: true })
    }
    const pending = this.video.play()
    if (pending) pending.catch(() => this.handlers.onNeedGesture())
  }

  private async playHls(url: string, token: number): Promise<void> {
    if (!Hls.isSupported()) {
      this.playNative(url, token)
      return
    }
    const buffer = this.settings().bufferSec
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      capLevelToPlayerSize: true,
      maxBufferLength: buffer,
      maxMaxBufferLength: Math.max(30, buffer),
      backBufferLength: 30,
      startPosition: this.item?.kind === 'live' ? -1 : (this.item?.startAt ?? -1),
      manifestLoadingTimeOut: 12000,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 4,
      renderTextTracksNatively: true,
    })
    this.hls = hls
    this.backend = 'hls'
    hls.attachMedia(this.video)
    hls.loadSource(url)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (token !== this.token) return
      this.applyCap(hls)
      this.emitHlsLevels()
      this.emitHlsAudio()
      this.maybeFrenchHls(hls)
    })
    hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => this.emitHlsAudio())
    hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
      this.emitHlsSubs()
      this.maybeFrenchHls(hls)
    })
    hls.on(Hls.Events.LEVEL_SWITCHED, () => this.emitHlsLevels())
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (token !== this.token || !data.fatal) return
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !this.mediaRecovered) {
        this.mediaRecovered = true
        hls.recoverMediaError()
        return
      }
      this.scheduleRetry('Le flux ne répond pas.', token)
    })
  }

  private applyCap(hls: Hls): void {
    const cap = this.settings().qualityCap
    if (!cap) {
      hls.autoLevelCapping = -1
      return
    }
    let max = -1
    hls.levels.forEach((level, index) => {
      if ((level.height ?? 0) <= cap) max = index
    })
    hls.autoLevelCapping = max
  }

  private emitHlsLevels(): void {
    if (!this.hls) return
    const levels = this.hls.levels.map((level, index) => ({
      index,
      height: level.height ?? 0,
      label: level.height ? `${level.height}p` : `${Math.round((level.bitrate ?? 0) / 1000)} kb/s`,
    }))
    this.handlers.onLevels(levels, this.hls.currentLevel)
  }

  private emitHlsAudio(): void {
    if (!this.hls) return
    const tracks = this.hls.audioTracks.map((track, index) => ({
      index,
      lang: track.lang || '',
      label: track.name || track.lang || `Piste ${index + 1}`,
    }))
    this.handlers.onAudio(tracks, this.hls.audioTrack)
  }

  private emitHlsSubs(): void {
    if (!this.hls) return
    const tracks = this.hls.subtitleTracks.map((track, index) => ({
      index,
      lang: track.lang || '',
      label: track.name || track.lang || `Sous-titres ${index + 1}`,
    }))
    this.handlers.onSubs(tracks, this.hls.subtitleTrack)
  }

  private maybeFrenchHls(hls: Hls): void {
    if (this.frenchDone) return
    const audio = hls.audioTracks[hls.audioTrack]
    const lang = (audio?.lang || '').toLowerCase()
    if (!lang || lang.startsWith('fr')) return
    const index = hls.subtitleTracks.findIndex((track) => {
      const code = (track.lang || '').toLowerCase()
      const name = (track.name || '').toLowerCase()
      return code.startsWith('fr') || name.includes('fran')
    })
    if (index < 0) return
    this.frenchDone = true
    hls.subtitleTrack = index
    this.emitHlsSubs()
    this.handlers.onStatus('Sous-titres français activés')
  }

  private async playDash(url: string, token: number): Promise<void> {
    const shaka = await loadShaka()
    shaka.polyfill.installAll()
    if (!shaka.Player.isBrowserSupported()) throw new Error('DASH non pris en charge par ce navigateur.')
    const player = new shaka.Player(this.video)
    this.shaka = player
    this.backend = 'dash'
    const buffer = this.settings().bufferSec
    const cap = this.settings().qualityCap
    try {
      player.configure({
        streaming: { bufferingGoal: buffer, rebufferingGoal: 2, bufferBehind: 30 },
        abr: { enabled: true, restrictions: cap ? { maxHeight: cap } : {} },
      })
    } catch {
      /* configuration ignorée si la version du lecteur la refuse */
    }
    player.addEventListener('error', (event) => {
      if (token !== this.token) return
      this.scheduleRetry(event.detail?.message || 'Le flux DASH a échoué.', token)
    })
    await player.load(url, this.item?.kind === 'live' ? null : (this.item?.startAt ?? null))
    if (token !== this.token) return
    const levels = player.getVariantTracks().map((track, index) => ({
      index,
      height: track.height ?? 0,
      label: track.height ? `${track.height}p` : `Variante ${index + 1}`,
    }))
    this.handlers.onLevels(levels, levels.findIndex((_, index) => player.getVariantTracks()[index]?.active) )
    const audio = player.getAudioTracks?.() ?? []
    this.handlers.onAudio(audio.map((track, index) => ({ index, lang: track.language || '', label: track.language || `Piste ${index + 1}` })), audio.findIndex((track) => track.active))
    const subs = player.getTextTracks()
    this.handlers.onSubs(subs.map((track, index) => ({ index, lang: track.language || '', label: track.label || track.language || `Sous-titres ${index + 1}` })), subs.findIndex((track) => track.active))
    const french = subs.findIndex((track) => (track.language || '').toLowerCase().startsWith('fr') || (track.label || '').toLowerCase().includes('fran'))
    const audioLang = (audio.find((track) => track.active)?.language || '').toLowerCase()
    if (french >= 0 && audioLang && !audioLang.startsWith('fr')) {
      player.selectTextTrack(subs[french])
      player.setTextTrackVisibility(true)
      this.handlers.onStatus('Sous-titres français activés')
    }
  }

  private async playTs(url: string, mode: 'mpegts' | 'flv', token: number): Promise<void> {
    const mpegts = (await import('mpegts.js')).default
    if (!mpegts.isSupported()) {
      this.playNative(url, token)
      return
    }
    const player = mpegts.createPlayer(
      { type: mode === 'flv' ? 'flv' : 'mpegts', isLive: this.item?.kind === 'live', url },
      { enableWorker: false, enableStashBuffer: true, stashInitialSize: 128, lazyLoad: false },
    )
    this.mpegts = player
    this.backend = 'ts'
    player.attachMediaElement(this.video)
    player.load()
    player.on(mpegts.Events.ERROR, () => {
      if (token === this.token) this.scheduleRetry('Le flux MPEG-TS a échoué.', token)
    })
  }

  private playNative(url: string, token: number): void {
    if (token !== this.token) return
    this.backend = 'native'
    this.video.src = url
    this.video.load()
  }

  private destroyBackends(): void {
    window.clearTimeout(this.retryTimer)
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
    if (this.shaka) {
      void this.shaka.destroy().catch(() => undefined)
      this.shaka = null
    }
    if (this.mpegts) {
      this.mpegts.destroy()
      this.mpegts = null
    }
    this.backend = 'none'
    this.video.querySelectorAll('track[data-external]').forEach((node) => node.remove())
    if (this.video.src) {
      this.video.removeAttribute('src')
      this.video.load()
    }
  }
}
