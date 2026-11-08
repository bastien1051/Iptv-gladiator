import { useEffect, useRef } from 'preact/hooks'
import { Engine } from '../player/engine'
import { downloadBlob, startCapture } from '../player/record'
import { slug } from '../lib/text'
import { activeSchedule, findChannel, finishSchedule, settings, toast, toPlayable } from '../store'

const quiet = {
  onStatus: () => undefined,
  onFatal: (message: string) => { const job = activeSchedule.value; if (job) finishSchedule(job.id, false, message) },
  onLevels: () => undefined,
  onAudio: () => undefined,
  onSubs: () => undefined,
  onTime: () => undefined,
  onPlaying: () => undefined,
  onNeedGesture: () => undefined,
}

export function ScheduleHost() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const job = activeSchedule.value

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = 0
    const engine = new Engine(video, () => ({ bufferSec: settings.value.bufferSec, qualityCap: settings.value.qualityCap }), quiet)
    engineRef.current = engine
    return () => engine.destroy()
  }, [])

  useEffect(() => {
    if (!job) return
    const channel = findChannel(job.channelId)
    const video = videoRef.current
    if (!channel || !video) {
      finishSchedule(job.id, false, 'Chaîne introuvable.')
      return
    }
    let stopTimer = 0
    let startTimer = 0
    let cancelled = false
    engineRef.current?.load(toPlayable(channel, 'live'))
    startTimer = window.setTimeout(() => {
      if (cancelled) return
      const started = startCapture(video)
      if ('error' in started) {
        finishSchedule(job.id, false, started.error)
        return
      }
      const remain = Math.max(1000, job.stop - Date.now())
      stopTimer = window.setTimeout(() => {
        void started.stop().then((blob) => {
          downloadBlob(blob, `${slug(job.title)}.webm`)
          finishSchedule(job.id, true)
          toast('Enregistrement téléchargé.')
        }).catch(() => finishSchedule(job.id, false, 'Enregistrement interrompu.'))
      }, remain)
    }, 2000)
    return () => {
      cancelled = true
      window.clearTimeout(startTimer)
      window.clearTimeout(stopTimer)
    }
  }, [job?.id])

  return <video ref={videoRef} class="rec-video" playsInline aria-hidden="true" />
}
