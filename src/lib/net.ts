function timeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortController === 'undefined') return undefined
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

function asError(error: unknown): Error {
  const message = errorMessage(error)
  if (message.startsWith('HTTP ') || message.startsWith('Parse') || message.startsWith('Délai') || message.startsWith('Décompression') || message.startsWith('Cette liste')) {
    return error instanceof Error ? error : new Error(message)
  }
  return new Error(`Cette liste est bloquée par le navigateur (CORS). Ce site est statique et ne peut pas la télécharger à sa place. Importez le fichier M3U sur l’appareil. Détail : ${message}`)
}

async function readText(url: string, timeoutMs: number): Promise<string> {
  let response: Response
  try {
    const signal = timeoutSignal(timeoutMs)
    response = await fetch(url, signal ? { signal } : undefined)
  } catch (error) {
    const detail = error instanceof Error ? error.message || error.name : 'Failed to fetch'
    if (/abort|timeout|délai/i.test(detail)) throw new Error('Délai dépassé')
    throw new Error(`CORS ou réseau : ${detail}`)
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 180)
    if (snippet.startsWith('HTTP ')) throw new Error(snippet)
    throw new Error(snippet ? `HTTP ${response.status} — ${snippet}` : `HTTP ${response.status}`)
  }
  return response.text()
}

export async function fetchText(url: string, timeoutMs = 60000): Promise<string> {
  try {
    return await readText(url, timeoutMs)
  } catch (error) {
    throw asError(error)
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 25000): Promise<T> {
  const text = await fetchText(url, timeoutMs)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Parse : JSON illisible. Début : ${text.replace(/\s+/g, ' ').trim().slice(0, 180)}`)
  }
}

export async function fetchXmlMaybeGzip(url: string, timeoutMs = 90000): Promise<string> {
  const signal = timeoutSignal(timeoutMs)
  let response: Response
  try {
    response = await fetch(url, signal ? { signal } : undefined)
  } catch (error) {
    throw asError(error)
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const gzip = bytes[0] === 0x1f && bytes[1] === 0x8b
  if (!gzip) return new TextDecoder().decode(bytes)
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Décompression gzip indisponible dans ce navigateur.')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'Délai dépassé'
    return error.message
  }
  return 'Erreur inconnue'
}
