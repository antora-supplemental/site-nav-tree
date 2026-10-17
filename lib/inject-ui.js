'use strict'

const fs = require('node:fs')
const path = require('node:path')

const UI_ROOT = path.join(__dirname, '..', 'ui')

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

function appendStylesheetLink (uiCatalog, href) {
  const head = uiCatalog.findByType('partial').find((f) => f.stem === 'head-meta')
  if (!head) return
  const body = Buffer.isBuffer(head.contents) ? head.contents.toString('utf8') : String(head.contents || '')
  const tag = `<link rel="stylesheet" href="{{{uiRootPath}}}/${href}">`
  if (body.includes(href)) return
  head.contents = Buffer.from(`${body.trim()}\n${tag}\n`)
}

function appendFooterScript (uiCatalog, src) {
  const foot = uiCatalog.findByType('partial').find((f) => f.stem === 'footer-scripts')
  if (!foot) return
  const body = Buffer.isBuffer(foot.contents) ? foot.contents.toString('utf8') : String(foot.contents || '')
  const tag = `<script src="{{{uiRootPath}}}/${src}" defer></script>`
  if (body.includes(src)) return
  foot.contents = Buffer.from(`${body.trim()}\n${tag}\n`)
}

function injectSiteNavTreeUi (uiCatalog, uiOutputDir, { filter = false, injectNavMenu = true } = {}) {
  if (injectNavMenu) {
    const navMenu = fs.readFileSync(path.join(UI_ROOT, 'partials', 'nav-menu.hbs'))
    addOrReplacePartial(uiCatalog, 'nav-menu', 'partials/nav-menu.hbs', navMenu)
  }

  const currentJs = fs.readFileSync(path.join(UI_ROOT, 'js', 'site-nav-tree-current.js'))
  addOrReplaceAsset(uiCatalog, uiOutputDir, 'js/site-nav-tree-current.js', currentJs)
  appendFooterScript(uiCatalog, 'js/site-nav-tree-current.js')

  if (filter) {
    const css = fs.readFileSync(path.join(UI_ROOT, 'css', 'nav-tree-filter.css'))
    const js = fs.readFileSync(path.join(UI_ROOT, 'js', 'nav-tree-filter.js'))
    addOrReplaceAsset(uiCatalog, uiOutputDir, 'css/nav-tree-filter.css', css)
    addOrReplaceAsset(uiCatalog, uiOutputDir, 'js/nav-tree-filter.js', js)
    appendStylesheetLink(uiCatalog, 'css/nav-tree-filter.css')
    appendFooterScript(uiCatalog, 'js/nav-tree-filter.js')
  }
}

module.exports = { injectSiteNavTreeUi }
