import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { basename, join, resolve } from 'node:path'
import { Readable } from 'node:stream'

const HOST = '127.0.0.1'
const PORT = Number(process.env.PORT || 8787)
const ROOT = resolve(process.env.RECORDINGS_DIR || join(process.cwd(), 'recordings'))
const jobs = new Map()

await mkdir(ROOT, { recursive: true })

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

function isHttp(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function safeName(name) {
  return basename(String(name || 'enregistrement')).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'enregistrement'
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function rewritePlaylist(text, baseUrl, requestUrl, ua, referer) {
  const resolveUrl = (value) => new URL(value, baseUrl).toString()
  const proxify = (absolute) => {
    const params = new URLSearchParams({ url: absolute })
    if (ua) params.set('ua', ua)
    if (referer) params.set('referer', referer)
    return `${requestUrl.origin}/proxy?${params}`
  }
  return text.split(/\r?\n/).map((line) => {
    if (!line.trim()) return line
    if (line.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_all, uri) => `URI="${proxify(resolveUrl(uri))}"`)
    return proxify(resolveUrl(line.trim()))
  }).join('\n')
}

async function proxy(req, res, target) {
  if (!isHttp(target)) {
    send(res, 400, { error: 'Adresse http(s) requise.' })
    return
  }
  const headers = {}
  if (req.headers.range) headers.range = req.headers.range
  const ua = new URL(req.url, 'http://local').searchParams.get('ua')
  const referer = new URL(req.url, 'http://local').searchParams.get('referer')
  if (ua) headers['user-agent'] = ua
  if (referer) headers.referer = referer
  const upstream = await fetch(target, { headers, redirect: 'follow' })
  const type = upstream.headers.get('content-type') || ''
  const textPromise = type.includes('mpegurl') || type.includes('m3u') || target.includes('.m3u') ? upstream.text() : null
  if (textPromise) {
    const text = await textPromise
    if (text.trim().startsWith('#EXTM3U')) {
      const rewritten = rewritePlaylist(text, upstream.url || target, new URL(req.url, `http://${req.headers.host}`), ua, referer)
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      })
      res.end(rewritten)
      return
    }
  }
  res.writeHead(upstream.status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': type || 'application/octet-stream',
    'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
    ...(upstream.headers.get('content-range') ? { 'Content-Range': upstream.headers.get('content-range') } : {}),
    ...(upstream.headers.get('content-length') ? { 'Content-Length': upstream.headers.get('content-length') } : {}),
  })
  if (upstream.body) Readable.fromWeb(upstream.body).pipe(res)
  else res.end()
}

function ffmpegAvailable() {
  return new Promise((resolveAvailable) => {
    const child = spawn('ffmpeg', ['-version'])
    child.on('error', () => resolveAvailable(false))
    child.on('exit', (code) => resolveAvailable(code === 0))
  })
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }
    if (url.pathname === '/health') {
      send(res, 200, { ok: true, ffmpeg: await ffmpegAvailable(), recordings: ROOT })
      return
    }
    if (url.pathname === '/proxy' && req.method === 'GET') {
      await proxy(req, res, url.searchParams.get('url') || '')
      return
    }
    if (url.pathname === '/record' && req.method === 'POST') {
      if (!(await ffmpegAvailable())) {
        send(res, 501, { error: 'ffmpeg est introuvable sur cette machine.' })
        return
      }
      const body = await readBody(req)
      if (!isHttp(body.url)) {
        send(res, 400, { error: 'Adresse http(s) requise.' })
        return
      }
      const seconds = Math.min(Math.max(Number(body.seconds) || 60, 5), 4 * 60 * 60)
      const id = `${Date.now()}-${safeName(body.title)}`
      const file = join(ROOT, `${id}.ts`)
      const args = ['-hide_banner', '-y']
      if (body.ua) args.push('-user_agent', String(body.ua))
      if (body.referer) args.push('-headers', `Referer: ${body.referer}\r\n`)
      args.push('-i', body.url, '-t', String(seconds), '-c', 'copy', file)
      const child = spawn('ffmpeg', args)
      jobs.set(id, { child, file, title: body.title || id, started: Date.now() })
      child.on('exit', () => jobs.delete(id))
      send(res, 202, { id, file: `${id}.ts`, seconds })
      return
    }
    if (url.pathname.startsWith('/record/') && url.pathname.endsWith('/stop') && req.method === 'POST') {
      const id = url.pathname.split('/')[2]
      const job = jobs.get(id)
      if (!job) {
        send(res, 404, { error: 'Enregistrement introuvable.' })
        return
      }
      job.child.kill('SIGINT')
      send(res, 200, { stopped: id })
      return
    }
    if (url.pathname === '/recordings' && req.method === 'GET') {
      const names = await readdir(ROOT)
      const files = []
      for (const name of names) {
        const info = await stat(join(ROOT, name))
        if (info.isFile()) files.push({ name, bytes: info.size, mtime: info.mtimeMs })
      }
      send(res, 200, files)
      return
    }
    if (url.pathname.startsWith('/recordings/') && req.method === 'GET') {
      const name = safeName(decodeURIComponent(url.pathname.slice('/recordings/'.length)))
      const file = join(ROOT, name)
      res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Content-Disposition': `attachment; filename="${name}"`, 'Access-Control-Allow-Origin': '*' })
      createReadStream(file).on('error', () => res.destroy()).pipe(res)
      return
    }
    send(res, 404, { error: 'Route inconnue.' })
  } catch (error) {
    send(res, 500, { error: error instanceof Error ? error.message : 'Erreur' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Relais IPTV Gladiator sur http://${HOST}:${PORT}`)
  console.log(`Enregistrements : ${ROOT}`)
})

process.on('unhandledRejection', (error) => {
  console.error(error)
})
