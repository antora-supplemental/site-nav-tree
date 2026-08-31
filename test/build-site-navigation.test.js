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
    const out = orderComponents(comps, { order: ['b'], exclude: [] })
    assert.deepEqual(
      out.map((c) => c.name),
      ['b', 'c', 'a']
    )
  })

  it('honors exclude', () => {
    const comps = [{ name: 'a' }, { name: 'b' }]
    const out = orderComponents(comps, { order: [], exclude: ['a'] })
    assert.deepEqual(
      out.map((c) => c.name),
      ['b']
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
    // NavigationCatalog keys: version@component
    const nav = {
      '@home': [{ content: 'Welcome', url: '/home/', urlType: 'internal' }],
      '@business-bootstrap': [
        { content: 'Org infra', url: '/business-bootstrap/infra/', urlType: 'internal' },
      ],
    }
    const getNav = (component, version) => nav[`${version}@${component}`]

    const catalog = mockCatalog([home, bb])
    const tree = buildSiteNavigation(catalog, getNav, 'home', '', {
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
