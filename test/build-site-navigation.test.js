'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  buildSiteNavigation,
  orderComponents,
  flattenNavTrees,
  unwrapStartPageDuplicate,
} = require('../lib/build-site-navigation')

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

describe('flattenNavTrees', () => {
  it('unwraps a single anonymous Antora nav tree', () => {
    const items = [{ content: 'Email', url: '/bb/email/' }]
    assert.deepEqual(flattenNavTrees([{ items }]), items)
  })

  it('leaves multi-tree or titled trees alone', () => {
    const trees = [
      { content: 'A', items: [] },
      { content: 'B', items: [] },
    ]
    assert.equal(flattenNavTrees(trees), trees)
  })
})

describe('unwrapStartPageDuplicate', () => {
  it('drops a leaf start-page link that matches component URL', () => {
    const items = [
      { content: 'Business Bootstrap', url: '/business-bootstrap/' },
      { content: 'Email', url: '/business-bootstrap/email/' },
    ]
    const out = unwrapStartPageDuplicate(items, '/business-bootstrap/', 'Business Bootstrap')
    assert.deepEqual(
      out.map((i) => i.content),
      ['Email']
    )
  })

  it('drops by title when URL styles differ', () => {
    const items = [
      { content: 'Business Bootstrap', url: '/business-bootstrap/index.html' },
      { content: 'Email', url: '/business-bootstrap/email/' },
    ]
    const out = unwrapStartPageDuplicate(items, '/business-bootstrap/', 'Business Bootstrap')
    assert.deepEqual(
      out.map((i) => i.content),
      ['Email']
    )
  })
})

describe('buildSiteNavigation', () => {
  it('flattens anonymous tree and unwraps start-page duplicate', () => {
    const bb = {
      name: 'business-bootstrap',
      title: 'Business Bootstrap',
      latest: { version: '', url: '/business-bootstrap/', title: 'Business Bootstrap' },
      versions: [{ version: '', url: '/business-bootstrap/', title: 'Business Bootstrap' }],
    }
    const nav = {
      '@business-bootstrap': [
        {
          items: [
            { content: 'Business Bootstrap', url: '/business-bootstrap/', urlType: 'internal' },
            { content: 'Email', url: '/business-bootstrap/email/', urlType: 'internal' },
          ],
        },
      ],
    }
    const getNav = (component, version) => nav[`${version}@${component}`]
    const tree = buildSiteNavigation(mockCatalog([bb]), getNav, 'business-bootstrap', '', {
      include: ['business-bootstrap'],
    })

    assert.equal(tree.length, 1)
    assert.equal(tree[0].content, 'Business Bootstrap')
    assert.equal(tree[0].url, '/business-bootstrap/')
    assert.equal(tree[0].items.length, 1)
    assert.equal(tree[0].items[0].content, 'Email')
  })
})
