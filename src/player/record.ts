export function canCapture(video: HTMLVideoElement): string | null {
  const element = video as HTMLVideoElement & { captureStream?: () => MediaStream }
  if (typeof MediaRecorder === 'undefined') return 'Ce navigateur ne propose pas MediaRecorder.'
  if (!element.captureStream) return 'Ce navigateur ne peut pas capturer l’image du lecteur.'
  return null
}

export function startCapture(video: HTMLVideoElement): { stop: () => Promise<Blob> } | { error: string } {
  const reason = canCapture(video)
  if (reason) return { error: reason }
  const element = video as HTMLVideoElement & { captureStream: () => MediaStream }
  let stream: MediaStream
  try {
    stream = element.captureStream()
  } catch {
    return { error: 'La capture a été refusée. Un flux sans CORS ne peut pas être enregistré dans le navigateur.' }
  }
  if (stream.getVideoTracks().length === 0) {
    return { error: 'Aucune piste vidéo à enregistrer. Le relais ffmpeg du dossier server/ est plus fiable.' }
  }
  const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
  let recorder: MediaRecorder
  try {
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  } catch {
    return { error: 'MediaRecorder a refusé ce flux.' }
  }
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.start(1000)
  return {
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }))
        recorder.onerror = () => reject(new Error('Enregistrement interrompu'))
        if (recorder.state !== 'inactive') recorder.stop()
        else resolve(new Blob(chunks, { type: 'video/webm' }))
      }),
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
