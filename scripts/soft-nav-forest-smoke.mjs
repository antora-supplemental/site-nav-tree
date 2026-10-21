/**
 * Headless click smoke for site-nav-tree + SoftNav on a live or local hub.
 *
 *   pnpm dlx playwright@1.49.0 install chromium
 *   node site-nav-tree/scripts/soft-nav-forest-smoke.mjs [baseUrl]
 *
 * Default baseUrl: https://docs.antora-supplemental.org/home/
 */
import { chromium } from 'playwright'

const baseUrl = process.argv[2] || 'https://docs.antora-supplemental.org/home/'
const errors = []

function log (msg) {
  process.stdout.write(`${msg}\n`)
}

async function waitForNavReady (page) {
  await page.waitForSelector('.nav-container [data-panel=menu] a.nav-link', { timeout: 30_000 })
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-snt-nav-ready') === '1',
    { timeout: 30_000 }
  )
}

async function main () {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  log(`Open ${baseUrl}`)
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await waitForNavReady(page)

  const forestRoots = await page.locator('li.nav-item[data-depth="0"]').count()
  log(`Forest roots: ${forestRoots}`)
  if (forestRoots < 2) {
    throw new Error('Expected multi-root site-nav-tree forest (data-depth=0 count >= 2)')
  }

  const initialPath = new URL(page.url()).pathname
  const crossLink = page
    .locator('.nav-container [data-panel=menu] a.nav-link')
    .filter({ hasNot: page.locator('[href^="#"]') })
    .filter({
      has: page.locator('xpath=..'),
    })
  const links = await page.$$eval('.nav-container [data-panel=menu] a.nav-link[href^="/"]', (as) =>
    as.map((a) => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim().slice(0, 60) }))
  )
  const startComp = initialPath.split('/').filter(Boolean)[0]
  const target = links.find((l) => l.href && l.href.split('/').filter(Boolean)[0] !== startComp)
  if (!target) {
    throw new Error(`No cross-component nav link found from ${startComp}`)
  }
  log(`Cross-component click: ${target.text} → ${target.href}`)

  await Promise.all([
    page.waitForFunction(
      (prev) => window.location.pathname !== prev,
      initialPath,
      { timeout: 15_000 }
    ),
    page.click(`.nav-container [data-panel=menu] a.nav-link[href="${target.href}"]`, { timeout: 10_000 }),
  ])

  const afterPath = new URL(page.url()).pathname
  const hardReload = await page.evaluate(() => !(window.history.state && (window.history.state.softNav || window.history.state.docNav)))
  const is404 = await page.locator('body.status-404, article.doc:has-text("Page not found")').count()

  log(`Path: ${initialPath} → ${afterPath}`)
  log(`history.state.softNav: ${!hardReload}`)
  log(`404 chrome: ${is404 > 0}`)

  if (is404 > 0) errors.push('Landmark page rendered 404 after nav click')
  if (hardReload) errors.push('Cross-component nav did a hard reload (missing SoftNav history state)')

  await page.waitForTimeout(500)
  await waitForNavReady(page)
  const dualCurrent = await page.evaluate(() => {
    const menu = document.querySelector('.nav-container [data-panel=menu]')
    if (!menu) return 0
    return menu.querySelectorAll('.nav-item.is-current-page').length
  })
  log(`is-current-page count: ${dualCurrent}`)
  if (dualCurrent > 1) errors.push(`Multiple is-current-page markers (${dualCurrent})`)

  await browser.close()
  if (errors.length) {
    errors.forEach((e) => log(`FAIL: ${e}`))
    process.exit(1)
  }
  log('OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
