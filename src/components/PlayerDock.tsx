import { useEffect, useRef, useState } from 'preact/hooks'
import { Engine } from '../player/engine'
import { fullscreenOn, prefersImmersiveFill, togglePlayerFullscreen } from '../lib/fullscreen'
import { phoneLayout } from '../lib/phone'
import { downloadBlob, startCapture } from '../player/record'
import { formatClock, formatTimecode, slug } from '../lib/text'
import { toVtt } from '../lib/subs'
import { Logo } from './rows'
import {
  closePlayer,
  consumePlayable,
  currentId,
  findChannel,
  go,
  guideFor,
  hotkeys,
  manualRecording,
  needsGesture,
  noteFailure,
  noteHealthy,
  nowMs,
  playKind,
  playPrevious,
  playerFatal,
  playerStatus,
  resumedFrom,
  restartFromBeginning,
  savePosition,
  settings,
  toPlayable,
  zap,
  playToken,
} from '../store'

export function PlayerDock({ compact }: { compact: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const idRef = useRef<string | null>(null)
  const captureRef = useRef<{ stop: () => Promise<Blob> } | null>(null)
  const [menu, setMenu] = useState<'none' | 'quality' | 'subs'>('none')
  const [levels, setLevels] = useState<{ index: number; label: string }[]>([])
  const [level, setLevel] = useState(-1)
  const [audio, setAudio] = useState<{ index: number; label: string }[]>([])
  const [subs, setSubs] = useState<{ index: number; label: string }[]>([])
  const [info, setInfo] = useState(false)
  const [muted, setMuted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [clock, setClock] = useState({ position: 0, duration: 0 })
  const [phone, setPhone] = useState(phoneLayout())
  const [chrome, setChrome] = useState(true)
  const [chromeTick, setChromeTick] = useState(0)
  const [more, setMore] = useState(false)
  const startedRef = useRef(false)
  const id = currentId.value
  const token = playToken.value
  idRef.current = id
  const channel = findChannel(id)
  const guide = channel ? guideFor(channel) : {}

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const engine = new Engine(video, () => ({ bufferSec: settings.value.bufferSec, qualityCap: settings.value.qualityCap }), {
      onStatus: (text) => { playerStatus.value = text },
      onFatal: (message) => {
        playerFatal.value = message
        playerStatus.value = ''
        if (!phoneLayout()) noteFailure(idRef.current)
      },
      onLevels: (next, current) => {
        setLevels(next)
        setLevel(current)
      },
      onAudio: (next) => setAudio(next),
      onSubs: (next) => setSubs(next),
      onTime: (position, duration) => {
        setClock({ position, duration })
        if (playKind.value !== 'live' && idRef.current) savePosition(idRef.current, position, duration, channel?.name || 'Lecture')
      },
      onPlaying: () => {
        startedRef.current = true
        setPlaying(true)
        needsGesture.value = false
        playerFatal.value = ''
        if (idRef.current) noteHealthy(idRef.current)
      },
      onNeedGesture: () => { needsGesture.value = true },
    })
    engineRef.current = engine
    const onPause = () => setPlaying(false)
    video.addEventListener('pause', onPause)
    hotkeys.mute = () => {
      video.muted = !video.muted
      setMuted(video.muted)
    }
    hotkeys.fullscreen = () => togglePlayerFullscreen()
    hotkeys.info = () => setInfo((value) => !value)
    hotkeys.play = () => {
      if (video.paused) void video.play()
      else video.pause()
    }
    hotkeys.record = () => { void toggleRecord() }
    return () => {
      video.removeEventListener('pause', onPause)
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 980px), (max-height: 520px)')
    const onChange = () => setPhone(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!fullscreenOn.value) {
      setChrome(true)
      return
    }
    const timer = window.setTimeout(() => {
      setChrome(false)
      setMore(false)
      setMenu('none')
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [fullscreenOn.value, chromeTick, id])

  useEffect(() => {
    startedRef.current = false
    setPlaying(false)
    if (!id) return
    const timer = window.setTimeout(() => {
      if (startedRef.current || !idRef.current) return
      playerFatal.value = 'Cette chaîne ne marche pas'
      playerStatus.value = ''
      if (!phoneLayout()) noteFailure(idRef.current)
      engineRef.current?.stop()
    }, 15000)
    return () => window.clearTimeout(timer)
  }, [id, token])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    if (!id) {
      engine.stop()
      return
    }
    const queued = consumePlayable()
    if (queued) {
      engine.load(queued)
      return
    }
    const found = findChannel(id)
    if (found) engine.load(toPlayable(found, 'live'))
  }, [id, token])

  async function toggleRecord(): Promise<void> {
    const video = videoRef.current
    if (!video) return
    if (captureRef.current) {
      try {
        const blob = await captureRef.current.stop()
        downloadBlob(blob, `${slug(channel?.name || 'enregistrement')}.webm`)
        manualRecording.value = false
        captureRef.current = null
      } catch {
        playerStatus.value = 'Enregistrement interrompu.'
        manualRecording.value = false
        captureRef.current = null
      }
      return
    }
    const started = startCapture(video)
    if ('error' in started) {
      playerStatus.value = started.error
      return
    }
    captureRef.current = started
    manualRecording.value = true
  }

  async function onSubtitleFile(file: File | undefined): Promise<void> {
    if (!file) return
    const text = await file.text()
    if (file.name.toLowerCase().endsWith('.srt')) engineRef.current?.addSubtitleText(toVtt(text), file.name)
    else engineRef.current?.addSubtitleText(text, file.name)
  }

  const lastTap = useRef(0)
  const title = channel?.name || (id ? 'Lecture' : 'Aucune chaîne')
  const nowTitle = guide.current ? `${guide.current.title} · ${formatClock(guide.current.start)}–${formatClock(guide.current.stop)}` : 'Programme non annoncé'

  function revealChrome(): void {
    setChrome(true)
    setChromeTick((value) => value + 1)
  }

  function onStagePointerUp(event: PointerEvent): void {
    const target = event.target
    if (target instanceof HTMLElement && target.closest('button, input, label, a, select')) return
    if (fullscreenOn.value) revealChrome()
    const now = Date.now()
    if (now - lastTap.current < 320) {
      lastTap.current = 0
      togglePlayerFullscreen()
    } else lastTap.current = now
  }

  const overlay = phone || fullscreenOn.value

  return (
    <section id="player-stage" class={`stage ${!id ? 'is-idle' : ''} ${compact ? 'compact' : ''} ${fullscreenOn.value ? 'is-fullscreen' : ''} ${fullscreenOn.value && prefersImmersiveFill() ? 'fill-screen' : ''} ${chrome || !fullscreenOn.value ? 'chrome-on' : 'chrome-off'}`} ref={stageRef} data-testid="stage" onPointerDown={() => { if (fullscreenOn.value) revealChrome() }} onPointerUp={onStagePointerUp}>
      <video ref={videoRef} data-testid="player-video" playsInline />
      {id && (
        <button type="button" class="player-close" data-testid="player-close" data-nav aria-label="Fermer" onClick={() => closePlayer()}>×</button>
      )}
      {needsGesture.value && (
        <button type="button" class={`gesture ${fullscreenOn.value && !chrome ? 'is-hidden' : ''}`} data-testid="play" data-nav onClick={() => { needsGesture.value = false; void videoRef.current?.play() }}>Lecture</button>
      )}
      {id && !playing && !playerFatal.value && !needsGesture.value && <p class={`loading-overlay ${fullscreenOn.value && !chrome ? 'is-hidden' : ''}`}>Connexion…</p>}
      {playerFatal.value && (
        <div class="fatal" data-testid="player-error">
          <p>Cette chaîne ne marche pas</p>
          <div class="row-actions">
            <button type="button" data-nav data-testid="player-error-close" onClick={() => closePlayer()}>Fermer</button>
            <button type="button" data-nav data-testid="player-error-next" onClick={() => { playerFatal.value = ''; zap(1) }}>Chaîne suivante</button>
          </div>
        </div>
      )}
      <div class="stage-copy">
        {channel && <Logo src={channel.logo} name={channel.name} />}
        <div>
          <button type="button" class="stage-title" data-nav onClick={() => { if (compact) go('direct'); else setInfo((value) => !value) }}>{title}</button>
          <p>{nowTitle}{guide.next ? ` · ensuite ${guide.next.title}` : ''}</p>
        </div>
      </div>
      {overlay && id && (
        <div class={`icon-bar ${fullscreenOn.value && !chrome ? 'is-hidden' : ''}`} data-testid="icon-bar">
          <button type="button" data-nav aria-label={playing ? 'Pause' : 'Lecture'} onClick={() => hotkeys.play()}>{playing ? '❚❚' : '▶'}</button>
          <button type="button" data-nav aria-label="Précédente" onClick={() => zap(-1)}>⏮</button>
          <button type="button" data-nav aria-label="Suivante" onClick={() => zap(1)}>⏭</button>
          <button type="button" data-nav data-testid="fullscreen" aria-label={fullscreenOn.value ? 'Quitter le plein écran' : 'Plein écran'} onClick={() => togglePlayerFullscreen()}>{fullscreenOn.value ? '⛶' : '⛶'}</button>
          <button type="button" data-nav data-testid="player-more" aria-label="Plus d’options" aria-expanded={more} onClick={() => { setMore((open) => !open); setMenu('none') }}>⋯</button>
        </div>
      )}
      {more && overlay && (
        <div class="popover more-menu" data-testid="player-more-menu">
          <button type="button" data-nav onClick={() => hotkeys.mute()}>{muted ? 'Son coupé' : 'Son'}</button>
          <button type="button" data-nav onClick={() => { setMenu(menu === 'quality' ? 'none' : 'quality'); setMore(false) }}>Qualité</button>
          <button type="button" data-nav onClick={() => { setMenu(menu === 'subs' ? 'none' : 'subs'); setMore(false) }}>Sous-titres</button>
          <button type="button" data-nav onClick={() => { void toggleRecord(); setMore(false) }}>{manualRecording.value ? 'Stop enregistrement' : 'Enregistrer'}</button>
        </div>
      )}
      {!overlay && !compact && (
        <div class="controls">
          <button type="button" data-nav onClick={() => hotkeys.play()}>{playing ? 'Pause' : 'Lecture'}</button>
          <button type="button" data-nav onClick={() => zap(-1)}>Précédente</button>
          <button type="button" data-nav onClick={() => zap(1)}>Suivante</button>
          <button type="button" data-nav onClick={() => playPrevious()}>Retour</button>
          <button type="button" data-nav onClick={() => hotkeys.mute()}>{muted ? 'Son coupé' : 'Son'}</button>
          <button type="button" data-nav onClick={() => setMenu(menu === 'quality' ? 'none' : 'quality')}>Qualité</button>
          <button type="button" data-nav onClick={() => setMenu(menu === 'subs' ? 'none' : 'subs')}>Sous-titres</button>
          <button type="button" data-nav onClick={() => { void toggleRecord() }}>{manualRecording.value ? 'Stop enregistrement' : 'Enregistrer'}</button>
          <button type="button" data-nav data-testid="fullscreen" onClick={() => togglePlayerFullscreen()}>{fullscreenOn.value ? 'Fenêtré' : 'Plein écran'}</button>
          {playKind.value !== 'live' && clock.duration > 0 && (
            <label class="seek">
              <span class="sr">Position</span>
              <input type="range" min={0} max={clock.duration} step={1} value={clock.position} onInput={(event) => { if (videoRef.current) videoRef.current.currentTime = Number((event.currentTarget as HTMLInputElement).value) }} />
              <span>{formatTimecode(clock.position)} / {formatTimecode(clock.duration)}</span>
            </label>
          )}
          {playerStatus.value && <p class="status">{playerStatus.value}</p>}
        </div>
      )}
      {menu === 'quality' && (
        <div class="popover">
          <button type="button" data-nav onClick={() => { engineRef.current?.setQuality(-1); setMenu('none') }}>Automatique</button>
          {levels.map((item) => (
            <button key={item.index} type="button" data-nav class={level === item.index ? 'on' : ''} onClick={() => { engineRef.current?.setQuality(item.index); setMenu('none') }}>{item.label}</button>
          ))}
          {levels.length === 0 && <p>Une seule qualité annoncée.</p>}
        </div>
      )}
      {menu === 'subs' && (
        <div class="popover">
          <button type="button" data-nav onClick={() => { engineRef.current?.setSub(-1); setMenu('none') }}>Aucun</button>
          {subs.map((item) => (
            <button key={item.index} type="button" data-nav onClick={() => { engineRef.current?.setSub(item.index); setMenu('none') }}>{item.label}</button>
          ))}
          {audio.length > 0 && <p class="fine">Pistes audio : {audio.map((item) => item.label).join(', ')}</p>}
          <label class="file">
            Fichier .srt ou .vtt
            <input type="file" accept=".srt,.vtt,text/vtt" onChange={(event) => { void onSubtitleFile((event.currentTarget as HTMLInputElement).files?.[0]) }} />
          </label>
        </div>
      )}
      {info && guide.current && (
        <div class="info-card">
          <h2>{guide.current.title}</h2>
          {guide.current.subtitle && <p>{guide.current.subtitle}</p>}
          {guide.current.desc && <p>{guide.current.desc}</p>}
        </div>
      )}
      {resumedFrom.value > 10 && (
        <button type="button" class="resume-inline" data-nav onClick={() => restartFromBeginning()}>Depuis le début</button>
      )}
      <span class="live-clock">{formatClock(nowMs.value)}</span>
    </section>
  )
}
