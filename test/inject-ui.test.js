'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { injectSiteNavTreeUi } = require('../lib/inject-ui')

function mockCatalog (partials = {}) {
  const files = []
  for (const [stem, body] of Object.entries(partials)) {
    files.push({ stem, contents: Buffer.from(body), type: 'partial' })
  }
  return {
    findByType (type) {
      return type === 'partial' ? files : []
    },
    addFile () {},
  }
}

test('injectSiteNavTreeUi skips script tag when hub footer already loads companion', () => {
  const uiCatalog = mockCatalog({
    'footer-content': `<footer></footer>\n<script src="{{{uiRootPath}}}/js/site-nav-tree-current.js?v=0.6.5" defer></script>\n`,
    'footer-scripts': '<script id="site-script" src="{{{uiRootPath}}}/js/site.js"></script>\n',
  })
  injectSiteNavTreeUi(uiCatalog, '_', { filter: false, injectNavMenu: false })
  const footerScripts = uiCatalog.findByType('partial').find((f) => f.stem === 'footer-scripts').contents.toString('utf8')
  const footerContent = uiCatalog.findByType('partial').find((f) => f.stem === 'footer-content').contents.toString('utf8')
  assert.equal((footerScripts.match(/site-nav-tree-current/g) || []).length, 0)
  assert.equal((footerContent.match(/site-nav-tree-current/g) || []).length, 1)
})
