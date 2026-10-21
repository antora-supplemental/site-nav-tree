'use strict'

const fs = require('node:fs')
const path = require('node:path')

const UI_ROOT = path.join(__dirname, '..', 'ui')
const PKG_VERSION = require('../package.json').version

const COMPANION_STYLES = [
  'site-nav-tree-overview-label.css',
  'site-nav-tree-mobile-drawer.css',
]

function addOrReplacePartial (uiCatalog, stem, relPath, contents) {
  const existing = uiCatalog.findByType('partial').find((f) => f.stem === stem)
  if (existing) {
    existing.contents = contents
    return
  }
  uiCatalog.addFile({
    contents,
    path: relPath,
    stem,
    type: 'partial',
  })
}

function addOrReplaceAsset (uiCatalog, uiOutputDir, relPath, contents) {
  const existing = uiCatalog.findByType('asset').find((f) => f.path === relPath)
  if (existing) {
    existing.contents = contents
    return
  }
  const dirname = path.posix.dirname(relPath)
  const basename = path.posix.basename(relPath)
  const outDir = dirname === '.' ? uiOutputDir : `${uiOutputDir}/${dirname}`
  uiCatalog.addFile({
    contents,
    type: 'asset',
    path: relPath,
    out: {
      dirname: outDir,
      path: `${outDir}/${basename}`,
      basename,
    },
  })
}

function appendToPartial (uiCatalog, stems, line) {
  const list = Array.isArray(stems) ? stems : [stems]
  for (const stem of list) {
    const partial = uiCatalog.findByType('partial').find((f) => f.stem === stem)
    if (!partial) continue
    const body = Buffer.isBuffer(partial.contents)
      ? partial.contents.toString('utf8')
      : String(partial.contents || '')
    if (body.includes(line)) return true
    partial.contents = Buffer.from(`${body.trim()}\n${line}\n`)
    return true
  }
  return false
}

function appendStylesheetLink (uiCatalog, href) {
  const tag = `<link rel="stylesheet" href="{{{uiRootPath}}}/${href}">`
  if (appendToPartial(uiCatalog, 'head-meta', tag)) return
  appendToPartial(uiCatalog, 'footer-content', tag)
}

function partialBody (uiCatalog, stem) {
  const partial = uiCatalog.findByType('partial').find((f) => f.stem === stem)
  if (!partial) return ''
  return Buffer.isBuffer(partial.contents)
    ? partial.contents.toString('utf8')
    : String(partial.contents || '')
}

/** Hub footers often load companions before soft-nav; skip duplicate script tags. */
function footerAlreadyReferences (uiCatalog, relPath) {
  const base = String(relPath).split('?')[0]
  return ['footer-scripts', 'footer-content'].some((stem) => partialBody(uiCatalog, stem).includes(base))
}

function appendFooterScript (uiCatalog, src) {
  const tag = `<script src="{{{uiRootPath}}}/${src}" defer></script>`
  if (appendToPartial(uiCatalog, 'footer-scripts', tag)) return
  appendToPartial(uiCatalog, 'footer-content', tag)
}

/** Styles ship on every enabled extension (even when injectUi is false and the hub vendors JS/partials). */
function injectSiteNavTreeStyles (uiCatalog, uiOutputDir, { filter = false } = {}) {
  for (const basename of COMPANION_STYLES) {
    const rel = `css/${basename}`
    const css = fs.readFileSync(path.join(UI_ROOT, 'css', basename))
    addOrReplaceAsset(uiCatalog, uiOutputDir, rel, css)
    appendStylesheetLink(uiCatalog, rel)
  }

  if (filter) {
    const css = fs.readFileSync(path.join(UI_ROOT, 'css', 'nav-tree-filter.css'))
    addOrReplaceAsset(uiCatalog, uiOutputDir, 'css/nav-tree-filter.css', css)
    appendStylesheetLink(uiCatalog, 'css/nav-tree-filter.css')
  }
}

function injectSiteNavTreeUi (
  uiCatalog,
  uiOutputDir,
  { filter = false, injectNavMenu = true, injectStyles = true } = {}
) {
  if (injectNavMenu) {
    const navMenu = fs.readFileSync(path.join(UI_ROOT, 'partials', 'nav-menu.hbs'))
    addOrReplacePartial(uiCatalog, 'nav-menu', 'partials/nav-menu.hbs', navMenu)
  }

  if (injectStyles) {
    injectSiteNavTreeStyles(uiCatalog, uiOutputDir, { filter })
  }

  const currentJs = fs.readFileSync(path.join(UI_ROOT, 'js', 'site-nav-tree-current.js'))
  addOrReplaceAsset(uiCatalog, uiOutputDir, 'js/site-nav-tree-current.js', currentJs)
  const currentSrc = `js/site-nav-tree-current.js?v=${PKG_VERSION}`
  if (!footerAlreadyReferences(uiCatalog, 'js/site-nav-tree-current.js')) {
    appendFooterScript(uiCatalog, currentSrc)
  }

  if (filter) {
    const js = fs.readFileSync(path.join(UI_ROOT, 'js', 'nav-tree-filter.js'))
    addOrReplaceAsset(uiCatalog, uiOutputDir, 'js/nav-tree-filter.js', js)
    appendFooterScript(uiCatalog, 'js/nav-tree-filter.js')
  }
}

module.exports = { injectSiteNavTreeStyles, injectSiteNavTreeUi }
