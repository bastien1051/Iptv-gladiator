import { useEffect, useRef, useState } from 'preact/hooks'
import { Engine } from '../player/engine'
import type { Channel } from '../types'
import { filterChannels } from '../lib/browse'
import { VirtualList } from './VirtualList'
import { adultChannels, adultUnlocked, channels, dead, hidden, multiHooks, settings } from '../store'
import { toPlayable } from '../store'

export function MultiView() {
  const [count, setCount] = useState<1 | 2 | 4>(1)
  const [ids, setIds] = useState<(string | null)[]>([null, null, null, null])
  const [audio, setAudio] = useState(0)
  const [picking, setPicking] = useState<number | null>(null)
  const idsRef = useRef(ids)
  const audioRef = useRef(audio)
  idsRef.current = ids
  audioRef.current = audio

  useEffect(() => {
    multiHooks.zap = (delta) => {
      const pool = channels.value.filter((channel) => !channel.adult)
      if (!pool.length) return
      const slot = audioRef.current
      const index = pool.findIndex((channel) => channel.id === idsRef.current[slot])
      const next = pool[(Math.max(index, 0) + delta + pool.length) % pool.length]
      setIds((current) => current.map((id, item) => item === slot ? next.id : id))
    }
    return () => { multiHooks.zap = null }
  }, [])

  const visible = ids.slice(0, count)

  return (
    <section class="page multi" data-testid="multi">
      <header class="page-head">
        <div>
          <p class="kicker">Plusieurs images</p>
          <h1>Écrans</h1>
        </div>
        <div class="chips">
          {([1, 2, 4] as const).map((value) => (
            <button key={value} type="button" data-nav class={count === value ? 'chip on' : 'chip'} onClick={() => setCount(value)}>{value}</button>
          ))}
        </div>
      </header>
      <div class={`mosaic mosaic-${count}`}>
        {visible.map((id, index) => (
          <Cell key={index} channelId={id} audible={audio === index} onFocusAudio={() => setAudio(index)} onPick={() => setPicking(index)} />
        ))}
      </div>
      {picking !== null && (
        <Picker onClose={() => setPicking(null)} onChoose={(channel) => {
          setIds((current) => current.map((id, index) => index === picking ? channel.id : id))
          setPicking(null)
        }} />
      )}
    </section>
  )
}

function Cell({ channelId, audible, onFocusAudio, onPick }: { channelId: string | null; audible: boolean; onFocusAudio: () => void; onPick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<Engine | null>(null)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const engine = new Engine(video, () => ({ bufferSec: settings.value.bufferSec, qualityCap: settings.value.qualityCap }), {
      onStatus: () => undefined,
      onFatal: () => undefined,
      onLevels: () => undefined,
      onAudio: () => undefined,
      onSubs: () => undefined,
      onTime: () => undefined,
      onPlaying: () => undefined,
      onNeedGesture: () => undefined,
    })
    engineRef.current = engine
    return () => engine.destroy()
  }, [])
  useEffect(() => {
    const channel = channels.value.find((item) => item.id === channelId) ?? (adultUnlocked.value ? adultChannels.value.find((item) => item.id === channelId) : undefined)
    if (!channel) return
    engineRef.current?.load(toPlayable(channel, 'live'))
  }, [channelId])
  useEffect(() => {
    const video = videoRef.current
    if (video) video.muted = !audible
  }, [audible])

  return (
    <article class={`cell ${audible ? 'audible' : ''}`}>
      <video ref={videoRef} playsInline muted={!audible} />
      <div class="cell-actions">
        <button type="button" data-nav onClick={onPick}>{channelId ? 'Changer' : 'Choisir une chaîne'}</button>
        <button type="button" data-nav onClick={onFocusAudio}>{audible ? 'Son ici' : 'Écouter'}</button>
      </div>
    </article>
  )
}

function Picker({ onClose, onChoose }: { onClose: () => void; onChoose: (channel: Channel) => void }) {
  const [text, setText] = useState('')
  const list = filterChannels({
    channels: channels.value,
    adult: adultChannels.value,
    includeAdult: adultUnlocked.value,
    shelf: 'all',
    groupBy: 'country',
    group: 'ALL',
    query: text,
    hidden: hidden.value,
    dead: dead.value,
    hideDead: settings.value.hideDead,
    favorites: [],
    recents: [],
  }).slice(0, 200)
  return (
    <div class="modal-back">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Choisir une chaîne">
        <header class="page-head">
          <h2>Choisir une chaîne</h2>
          <button type="button" data-nav onClick={onClose}>Fermer</button>
        </header>
        <input data-nav placeholder="Rechercher" value={text} onInput={(event) => setText((event.currentTarget as HTMLInputElement).value)} />
        <div class="picker-list">
          <VirtualList items={list} rowHeight={56} render={(channel) => (
            <button type="button" class="picker-row" data-nav onClick={() => onChoose(channel)}>{channel.name}</button>
          )} />
        </div>
      </div>
    </div>
  )
}
