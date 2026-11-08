import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const outDir = '/opt/cursor/artifacts'
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-dev-shm-usage'],
})

const errors = []
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
page.on('pageerror', (error) => errors.push(String(error)))

await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.waitForFunction(() => {
  const home = document.querySelector('[data-testid="home"]')
  if (!home) return false
  return Number(home.getAttribute('data-channels')) > 150 && Number(home.getAttribute('data-combat')) > 0 && home.getAttribute('data-indexed') === '1'
}, { timeout: 120000 })

const counts = await page.locator('[data-testid="home"]').evaluate((element) => ({
  channels: element.getAttribute('data-channels'),
  sport: element.getAttribute('data-sport'),
  combat: element.getAttribute('data-combat'),
  indexed: element.getAttribute('data-indexed'),
}))
console.log('counts', counts)
await page.waitForFunction(() => !document.querySelector('.loading-bar'), { timeout: 90000 }).catch(() => console.log('guide still loading'))
await page.locator('[data-testid="shelf-combat"]').scrollIntoViewIfNeeded()
await page.screenshot({ path: `${outDir}/accueil-desktop.png`, fullPage: false })

await page.setViewportSize({ width: 390, height: 844 })
await page.locator('[data-testid="shelf-sport"]').scrollIntoViewIfNeeded()
await page.screenshot({ path: `${outDir}/accueil-mobile.png` })

await page.setViewportSize({ width: 1440, height: 900 })
const candidates = ['20 Minutes', 'Africa 24', 'BFM2', 'France 24']
let played = null
for (const name of candidates) {
  await page.goto('http://127.0.0.1:4178/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-testid="home"]')
  await page.locator('[data-testid="search"]').fill(name)
  const row = page.locator('.row-main', { hasText: name }).first()
  try {
    await row.waitFor({ timeout: 8000 })
  } catch {
    console.log('no row', name)
    continue
  }
  await row.click()
  try {
    await page.waitForFunction(() => {
      const video = document.querySelector('video')
      return !!video && video.readyState >= 2 && video.videoWidth > 0 && !video.paused
    }, { timeout: 20000 })
    played = await page.evaluate(() => {
      const video = document.querySelector('video')
      return { width: video.videoWidth, height: video.videoHeight, time: video.currentTime, src: video.currentSrc?.slice(0, 140) }
    })
    console.log('played', name, played)
    await page.screenshot({ path: `${outDir}/lecture-desktop.png` })
    break
  } catch {
    const fatal = await page.locator('.fatal').textContent().catch(() => '')
    console.log('failed', name, fatal?.slice(0, 180))
  }
}

await page.getByRole('button', { name: 'Adulte' }).click()
await page.waitForSelector('[data-testid="adult-gate"]')
const adultText = await page.locator('[data-testid="adult-gate"]').innerText()
const adultHasList = await page.locator('[data-testid="adult-list"]').count()
console.log('adult gate', adultHasList === 0, adultText.includes('18'))
await page.screenshot({ path: `${outDir}/adulte-code.png` })

console.log('console errors', errors.length)
for (const error of errors) console.log('ERR', error.slice(0, 300))
await browser.close()
if (!played) process.exitCode = 2
