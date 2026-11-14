import { env, pipeline, Tensor, type ProgressInfo } from '@huggingface/transformers'

const WHISPER = 'Xenova/whisper-tiny'
const TRANSLATOR = 'Xenova/opus-mt-en-fr'

type InMessage =
  | { type: 'init' }
  | { type: 'audio'; samples: Float32Array }
  | { type: 'stop' }

type Asr = {
  model: {
    generation_config?: {
      is_multilingual?: boolean
      lang_to_id?: Record<string, number>
      decoder_start_token_id?: number
    }
    (inputs: Record<string, unknown>): Promise<{ logits?: { data: ArrayLike<number>; dims: number[] } }>
  }
  processor: (audio: Float32Array) => Promise<{ input_features: unknown }>
  (audio: Float32Array, options: Record<string, unknown>): Promise<{ text?: string }>
}

type Translator = (text: string) => Promise<{ translation_text?: string } | Array<{ translation_text?: string }>>

let asr: Asr | null = null
let translator: Translator | null = null
let device: 'webgpu' | 'wasm' = 'wasm'
let busy = false
let stopped = false

env.allowLocalModels = false
env.useBrowserCache = true
env.cacheKey = 'iptv-gladiator-models'

function post(data: Record<string, unknown>): void {
  ;(self as unknown as { postMessage: (message: unknown) => void }).postMessage(data)
}

function reportProgress(info: ProgressInfo): void {
  if (info.status === 'progress') {
    post({ type: 'progress', progress: Math.round(info.progress), label: info.file })
  } else if (info.status === 'progress_total') {
    post({ type: 'progress', progress: Math.round(info.progress), label: info.name })
  }
}

async function loadAsr(): Promise<Asr> {
  const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator
  const order: Array<'webgpu' | 'wasm'> = gpu ? ['webgpu', 'wasm'] : ['wasm']
  let last: unknown
  for (const candidate of order) {
    try {
      const model = await pipeline('automatic-speech-recognition', WHISPER, {
        dtype: 'q8',
        device: candidate,
        progress_callback: reportProgress,
      })
      device = candidate
      return model as unknown as Asr
    } catch (error) {
      last = error
    }
  }
  throw last instanceof Error ? last : new Error('Modèle de reconnaissance indisponible')
}

async function loadTranslator(): Promise<Translator> {
  const model = await pipeline('translation', TRANSLATOR, {
    dtype: 'q8',
    device,
    progress_callback: reportProgress,
  })
  return model as unknown as Translator
}

async function detectLanguage(model: Asr, samples: Float32Array): Promise<string> {
  const config = model.model.generation_config
  const table = config?.lang_to_id
  if (!config?.is_multilingual || !table) return 'en'
  const features = await model.processor(samples)
  const start = Number(config.decoder_start_token_id ?? 50258)
  const decoder = new Tensor('int64', BigInt64Array.from([BigInt(start)]), [1, 1])
  const output = await model.model({ input_features: features.input_features, decoder_input_ids: decoder })
  const logits = output.logits
  if (!logits) return 'en'
  const vocab = logits.dims[logits.dims.length - 1] || 0
  const data = logits.data
  const offset = Math.max(0, data.length - vocab)
  let best = -Infinity
  let code = 'en'
  for (const [token, id] of Object.entries(table)) {
    const score = Number(data[offset + Number(id)] ?? -Infinity)
    if (score > best) {
      best = score
      code = token.replace(/^<\|/, '').replace(/\|>$/, '')
    }
  }
  return code || 'en'
}

function translatedText(result: { translation_text?: string } | Array<{ translation_text?: string }>): string {
  if (Array.isArray(result)) return result[0]?.translation_text || ''
  return result.translation_text || ''
}

async function transcribe(samples: Float32Array): Promise<void> {
  if (!asr) return
  const language = await detectLanguage(asr, samples)
  post({ type: 'language', language })
  if (language === 'fr') return
  const english = await asr(samples, {
    language,
    task: 'translate',
    return_timestamps: false,
    max_new_tokens: 64,
  })
  const source = (english.text || '').replace(/\s+/g, ' ').trim()
  if (!source) return
  if (!translator) {
    post({ type: 'status', text: 'Téléchargement du modèle de traduction…' })
    translator = await loadTranslator()
  }
  const french = translatedText(await translator(source)).replace(/\s+/g, ' ').trim()
  if (french) post({ type: 'caption', text: french, language })
}

self.addEventListener('message', (event: MessageEvent<InMessage>) => {
  const message = event.data
  if (!message) return
  if (message.type === 'stop') {
    stopped = true
    busy = false
    return
  }
  if (message.type === 'init') {
    stopped = false
    void (async () => {
      try {
        post({ type: 'status', text: 'Téléchargement du modèle de reconnaissance…' })
        asr = await loadAsr()
        if (!stopped) post({ type: 'ready', device })
      } catch (error) {
        post({ type: 'error', message: error instanceof Error ? error.message : 'Sous-titres auto indisponibles' })
      }
    })()
    return
  }
  if (message.type === 'audio') {
    if (stopped || !asr || busy) return
    busy = true
    const samples = message.samples
    void (async () => {
      try {
        await transcribe(samples)
      } catch (error) {
        post({ type: 'error', message: error instanceof Error ? error.message : 'Reconnaissance interrompue' })
      } finally {
        busy = false
      }
    })()
  }
})
