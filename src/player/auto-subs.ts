import { downsample, peakAbs, usableCaption } from './auto-subs-policy'

const TARGET_RATE = 16000
const CHUNK_SECONDS = 6
const SILENT_PEAK = 0.004

export type AutoSubEvents = {
  onCaption: (text: string) => void
  onProgress: (progress: number, label: string) => void
  onStatus: (text: string) => void
  onLanguage: (language: string) => void
  onUnavailable: (message: string) => void
}

type Capture = {
  context: AudioContext
  stream: MediaStream
  source: MediaStreamAudioSourceNode
  processor: ScriptProcessorNode
  gain: GainNode
}

export class AutoSubs {
  private worker: Worker | null = null
  private capture: Capture | null = null
  private pending = new Float32Array(0)
  private ready = false
  private stopped = true
  private silentChunks = 0
  private events: AutoSubEvents | null = null
  private arm = 0

  start(video: HTMLVideoElement, events: AutoSubEvents): void {
    this.stop()
    this.stopped = false
    this.events = events
    this.ready = false
    this.pending = new Float32Array(0)
    this.silentChunks = 0
    this.arm = window.setTimeout(() => {
      if (!this.stopped) this.attach(video, events)
    }, 1600)
  }

  private attach(video: HTMLVideoElement, events: AutoSubEvents): void {
    let stream: MediaStream | undefined
    try {
      const cap = video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }
      stream = cap.captureStream?.() ?? cap.mozCaptureStream?.()
      if (!stream || stream.getAudioTracks().length === 0) throw new Error('silence')
    } catch {
      events.onUnavailable('Sous-titres auto indisponibles pour cette chaîne')
      return
    }
    try {
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const processor = context.createScriptProcessor(4096, 1, 1)
      const gain = context.createGain()
      gain.gain.value = 0
      processor.onaudioprocess = (event) => this.onAudio(event)
      source.connect(processor)
      processor.connect(gain)
      gain.connect(context.destination)
      this.capture = { context, stream, source, processor, gain }
    } catch {
      stream?.getTracks().forEach((track) => track.stop())
      events.onUnavailable('Sous-titres auto indisponibles pour cette chaîne')
      return
    }
    try {
      this.worker = new Worker(new URL('./auto-subs.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      this.releaseCapture()
      events.onUnavailable('Sous-titres auto indisponibles pour cette chaîne')
      return
    }
    this.worker.onmessage = (event: MessageEvent<Record<string, unknown>>) => this.onWorker(event.data)
    this.worker.onerror = () => {
      events.onStatus('Sous-titres auto interrompus. La lecture continue.')
    }
    this.worker.postMessage({ type: 'init' })
    const startedAt = video.currentTime
    window.setTimeout(() => {
      if (this.stopped) return
      if (video.currentTime < startedAt + 0.35) {
        this.releaseCapture()
        events.onUnavailable('Sous-titres auto indisponibles pour cette chaîne')
      }
    }, 1800)
  }

  stop(): void {
    this.stopped = true
    this.ready = false
    window.clearTimeout(this.arm)
    this.pending = new Float32Array(0)
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' })
      this.worker.terminate()
      this.worker = null
    }
    this.releaseCapture()
    this.events = null
  }

  private releaseCapture(): void {
    const capture = this.capture
    this.capture = null
    if (!capture) return
    try {
      capture.processor.onaudioprocess = null
      capture.source.disconnect()
      capture.processor.disconnect()
      capture.gain.disconnect()
      capture.stream.getTracks().forEach((track) => track.stop())
      void capture.context.close()
    } catch {
      /* la lecture du flux ne dépend pas de cette capture */
    }
  }

  private onAudio(event: AudioProcessingEvent): void {
    if (this.stopped) return
    const input = event.inputBuffer.getChannelData(0)
    const rate = event.inputBuffer.sampleRate || this.capture?.context.sampleRate || 48000
    const piece = downsample(input, rate, TARGET_RATE)
    const next = new Float32Array(this.pending.length + piece.length)
    next.set(this.pending, 0)
    next.set(piece, this.pending.length)
    const chunk = TARGET_RATE * CHUNK_SECONDS
    if (next.length < chunk) {
      this.pending = next
      return
    }
    const samples = next.slice(0, chunk)
    this.pending = next.slice(chunk)
    if (peakAbs(samples) < SILENT_PEAK) {
      this.silentChunks += 1
      if (this.silentChunks >= 2) {
        const events = this.events
        this.stop()
        events?.onUnavailable('Sous-titres auto indisponibles pour cette chaîne')
      }
      return
    }
    this.silentChunks = 0
    if (!this.ready || !this.worker) return
    const copy = new Float32Array(samples)
    this.worker.postMessage({ type: 'audio', samples: copy }, [copy.buffer])
  }

  private onWorker(data: Record<string, unknown>): void {
    if (this.stopped || !this.events) return
    if (data.type === 'progress') {
      this.events.onProgress(Number(data.progress) || 0, String(data.label || ''))
      return
    }
    if (data.type === 'status') {
      this.events.onStatus(String(data.text || ''))
      return
    }
    if (data.type === 'ready') {
      this.ready = true
      this.events.onStatus('')
      return
    }
    if (data.type === 'language') {
      this.events.onLanguage(String(data.language || ''))
      return
    }
    if (data.type === 'caption') {
      const text = usableCaption(String(data.text || ''))
      if (text) this.events.onCaption(text)
      return
    }
    if (data.type === 'error') {
      this.events.onStatus('Sous-titres auto interrompus. La lecture continue.')
    }
  }
}
