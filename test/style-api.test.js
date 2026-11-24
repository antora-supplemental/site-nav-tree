'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { validateThemeCss } = require('../lib/validate-style')

test('built-in framed theme strictly conforms to site-nav-tree-style-api@1', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'ui', 'css', 'themes', 'framed.css'),
    'utf8'
  )
  const res = validateThemeCss(css, { strict: true })
  assert.deepEqual(res.errors, [])
  assert.equal(res.ok, true)
  assert.equal(res.contract, 'site-nav-tree-style-api')
})

test('validateThemeCss rejects private internal classes and layout-breaking overflow overrides', () => {
  const bad = `
    .nav-item[data-depth="0"] > .nav-link { color: #ff0000; }
    [data-snt-part="tree"] { overflow-x: hidden; --unknown-token: 1px; }
  `
  const res = validateThemeCss(bad, { strict: true })
  assert.equal(res.ok, false)
  assert.ok(res.errors.some((e) => e.includes('private class .nav-item')))
  assert.ok(res.errors.some((e) => e.includes('overflow-x')))
  assert.ok(res.errors.some((e) => e.includes('unknown token "--unknown-token"')))
  assert.ok(res.errors.some((e) => e.includes('literal color')))
})

test('site-nav-tree-scroll.css enables horizontal scroll + thin scrollbar + edge fades', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'ui', 'css', 'site-nav-tree-scroll.css'),
    'utf8'
  )
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.match(code, /overflow-x:\s*auto\s*!important/)
  assert.match(code, /scrollbar-width:\s*thin/)
  assert.match(code, /data-snt-overflow-start='true'/)
  assert.match(code, /data-snt-overflow-end='true'/)
})
