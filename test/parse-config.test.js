'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { parseNavFilter, parseNavTheme, resolveInjectUi } = require('../lib/parse-config')

describe('parseNavFilter', () => {
  it('accepts boolean filter and aliases', () => {
    assert.equal(parseNavFilter({ filter: true }), true)
    assert.equal(parseNavFilter({ navFilter: true }), true)
    assert.equal(parseNavFilter({ navTreeFilter: true }), true)
  })

  it('accepts filter.enabled object form', () => {
    assert.equal(parseNavFilter({ filter: { enabled: true } }), true)
    assert.equal(parseNavFilter({ filter: { enabled: false } }), false)
  })

  it('defaults off', () => {
    assert.equal(parseNavFilter({}), false)
    assert.equal(parseNavFilter({ filter: false }), false)
  })
})

describe('resolveInjectUi', () => {
  it('enables injection when filter is on unless opted out', () => {
    assert.equal(resolveInjectUi({}, true), true)
    assert.equal(resolveInjectUi({ injectUi: false }, true), false)
    assert.equal(resolveInjectUi({ ui: false }, true), false)
  })

  it('requires explicit opt-in when filter is off', () => {
    assert.equal(resolveInjectUi({}, false), false)
    assert.equal(resolveInjectUi({ injectUi: true }, false), true)
    assert.equal(resolveInjectUi({ ui: true }, false), true)
  })
})

describe('parseNavTheme', () => {
  it('defaults to default and accepts framed', () => {
    assert.equal(parseNavTheme({}), 'default')
    assert.equal(parseNavTheme({ theme: 'framed' }), 'framed')
    assert.equal(parseNavTheme({ theme: 'FRAMED' }), 'framed')
    assert.equal(parseNavTheme({ theme: 'unknown' }), 'default')
  })
})
