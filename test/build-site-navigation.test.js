'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { buildSiteNavigation, orderComponents } = require('../lib/build-site-navigation')

function mockCatalog (components) {
  return {
    getComponentsSortedBy () {
      return [...components].sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name))
    },
    getComponentVersion (component, version) {
      return component.versions.find((v) => v.version === version)
    },
  }
}

describe('orderComponents', () => {
  it('puts named order first, then remaining title order', () => {
    const comps = [{ name: 'c' }, { name: 'a' }, { name: 'b' }]
    const out = orderComponents(comps, { order: ['b'], exclude: [], include: [] })
    assert.deepEqual(
      out.map((c) => c.name),
      ['b', 'c', 'a']
    )
  })

  it('honors exclude', () => {
    const comps = [{ name: 'a' }, { name: 'b' }]
    const out = orderComponents(comps, { order: [], exclude: ['a'], include: [] })
    assert.deepEqual(
      out.map((c) => c.name),
      ['b']
    )
  })

  it('honors include allowlist and uses include order when order empty', () => {
    const comps = [{ name: 'stub' }, { name: 'home' }, { name: 'gk' }]
    const out = orderComponents(comps, {
      order: [],
      exclude: [],
      include: ['home', 'gk'],
    })
    assert.deepEqual(
      out.map((c) => c.name),
      ['home', 'gk']
    )
  })

  it('exclude wins over include', () => {
    const comps = [{ name: 'home' }, { name: 'gk' }]
    const out = orderComponents(comps, {
      order: [],
      exclude: ['gk'],
      include: ['home', 'gk'],
    })
    assert.deepEqual(
      out.map((c) => c.name),
      ['home']
    )
  })
})

describe('buildSiteNavigation', () => {
  it('wraps each component nav as a root item and keeps child trees', () => {
    const home = {
      name: 'home',
      title: 'Home',
      latest: { version: '', url: '/home/', title: 'Home' },
      versions: [{ version: '', url: '/home/', title: 'Home' }],
    }
    const bb = {
      name: 'business-bootstrap',
      title: 'Business Bootstrap',
      latest: { version: '', url: '/business-bootstrap/', title: 'Business Bootstrap' },
      versions: [{ version: '', url: '/business-bootstrap/', title: 'Business Bootstrap' }],
    }
    const stub = {
      name: 'ver',
      title: 'Ver',
      latest: { version: '', url: '/ver/', title: 'Ver' },
      versions: [{ version: '', url: '/ver/', title: 'Ver' }],
    }
    const nav = {
      '@home': [{ content: 'Welcome', url: '/home/', urlType: 'internal' }],
      '@business-bootstrap': [
        { content: 'Org infra', url: '/business-bootstrap/infra/', urlType: 'internal' },
      ],
      '@ver': [{ content: 'Overview', url: '/ver/', urlType: 'internal' }],
    }
    const getNav = (component, version) => nav[`${version}@${component}`]

    const catalog = mockCatalog([home, bb, stub])
    const tree = buildSiteNavigation(catalog, getNav, 'home', '', {
      include: ['home', 'business-bootstrap'],
      order: ['home', 'business-bootstrap'],
      exclude: [],
    })

    assert.equal(tree.length, 2)
    assert.equal(tree[0].content, 'Home')
    assert.equal(tree[0].url, '/home/')
    assert.equal(tree[0].items[0].content, 'Welcome')
    assert.equal(tree[1].content, 'Business Bootstrap')
    assert.equal(tree[1].items[0].content, 'Org infra')
  })
})
