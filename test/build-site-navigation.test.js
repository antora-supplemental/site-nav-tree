'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  buildSiteNavigation,
  orderComponents,
  flattenNavTrees,
  unwrapStartPageDuplicate,
  ensureOverviewChild,
  hardSortHomeThenChangelog,
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
  it('renames a leaf start-page link to Overview instead of dropping it', () => {
    const items = [
      { content: 'Business Bootstrap', url: '/business-bootstrap/' },
      { content: 'Email', url: '/business-bootstrap/email/' },
    ]
    const out = unwrapStartPageDuplicate(items, '/business-bootstrap/', 'Business Bootstrap')
    assert.deepEqual(
      out.map((i) => i.content),
      ['Overview', 'Email']
    )
    assert.equal(out[0].url, '/business-bootstrap/')
  })

  it('renames by title when URL styles differ', () => {
    const items = [
      { content: 'Business Bootstrap', url: '/business-bootstrap/index.html' },
      { content: 'Email', url: '/business-bootstrap/email/' },
    ]
    const out = unwrapStartPageDuplicate(items, '/business-bootstrap/', 'Business Bootstrap')
    assert.deepEqual(
      out.map((i) => i.content),
      ['Overview', 'Email']
    )
  })

  it('promotes linked start-page parent children and prepends Overview', () => {
    const items = [
      {
        content: 'Overview',
        url: '/platforms/',
        items: [{ content: 'Child', url: '/platforms/child/' }],
      },
      { content: 'Other', url: '/platforms/other/' },
    ]
    const out = unwrapStartPageDuplicate(items, '/platforms/', 'Platforms')
    assert.deepEqual(
      out.map((i) => i.content),
      ['Overview', 'Child', 'Other']
    )
  })
})

describe('hardSortHomeThenChangelog', () => {
  it('puts Home then Changelog before the rest', () => {
    const items = [
      { content: 'Email', url: '/bb/email/' },
      { content: 'Changelog', url: '/bb/changelog/' },
      { content: 'Home', url: '/bb/' },
      { content: 'Vault', url: '/bb/vault/' },
    ]
    assert.deepEqual(
      hardSortHomeThenChangelog(items).map((i) => i.content),
      ['Home', 'Changelog', 'Email', 'Vault']
    )
  })

  it('treats Overview as Home and Activity Log as changelog', () => {
    const items = [
      { content: 'Usage', url: '/ar/usage/' },
      { content: 'Activity Log', url: '/home/activity-log/' },
      { content: 'Overview', url: '/ar/' },
    ]
    assert.deepEqual(
      hardSortHomeThenChangelog(items).map((i) => i.content),
      ['Overview', 'Activity Log', 'Usage']
    )
  })

  it('recurses into children', () => {
    const items = [
      {
        content: 'DevCentr',
        items: [
          { content: 'Capabilities', url: '/platforms/devcentr/capabilities/' },
          { content: 'Changelog', url: '/platforms/devcentr/changelog/' },
          { content: 'Home', url: '/platforms/devcentr/' },
        ],
      },
    ]
    const out = hardSortHomeThenChangelog(items)
    assert.deepEqual(
      out[0].items.map((i) => i.content),
      ['Home', 'Changelog', 'Capabilities']
    )
  })
})

describe('buildSiteNavigation', () => {
  it('flattens anonymous tree, renames start-page duplicate to Overview, hard-sorts', () => {
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
            { content: 'Changelog', url: '/business-bootstrap/changelog/', urlType: 'internal' },
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
    assert.deepEqual(
      tree[0].items.map((i) => i.content),
      ['Overview', 'Changelog', 'Email']
    )
  })

  it('keeps multi-root component nav siblings under the component root', () => {
    const gk = {
      name: 'general-knowledge',
      title: 'General Knowledge',
      latest: { version: '', url: '/general-knowledge/', title: 'General Knowledge' },
      versions: [{ version: '', url: '/general-knowledge/', title: 'General Knowledge' }],
    }
    const area = (content, url) => ({
      content,
      url,
      urlType: 'internal',
      items: [{ content: `${content} child`, url: `${url}child/`, urlType: 'internal' }],
    })
    const nav = {
      '@general-knowledge': [
        { content: 'Tutorials', items: [{ content: 'Onboarding', url: '/general-knowledge/tutorials/onboarding/' }] },
        area('How-to Guides', '/general-knowledge/how-to/'),
        area('Reference', '/general-knowledge/reference/'),
        area('Explanation', '/general-knowledge/explanation/'),
      ],
    }
    const getNav = (component, version) => nav[`${version}@${component}`]
    const tree = buildSiteNavigation(mockCatalog([gk]), getNav, 'general-knowledge', '', {
      include: ['general-knowledge'],
    })

    assert.equal(tree.length, 1)
    assert.deepEqual(
      tree[0].items.map((i) => i.content),
      ['Overview', 'Tutorials', 'How-to Guides', 'Reference', 'Explanation']
    )
  })

  it('preserves sibling linked parents after flattening one anonymous wrapper', () => {
    const gk = {
      name: 'general-knowledge',
      title: 'General Knowledge',
      latest: { version: '', url: '/general-knowledge/', title: 'General Knowledge' },
      versions: [{ version: '', url: '/general-knowledge/', title: 'General Knowledge' }],
    }
    const nav = {
      '@general-knowledge': [
        {
          items: [
            { content: 'Changelog', url: '/general-knowledge/changelog/' },
            { content: 'Tutorials', items: [{ content: 'Onboarding', url: '/gk/t/' }] },
            { content: 'How-to Guides', url: '/general-knowledge/how-to/', items: [{ content: 'Nushell', url: '/gk/h/' }] },
            { content: 'Reference', url: '/general-knowledge/reference/', items: [{ content: 'Tools', url: '/gk/r/' }] },
            { content: 'Explanation', url: '/general-knowledge/explanation/', items: [{ content: 'Why', url: '/gk/e/' }] },
          ],
        },
      ],
    }
    const getNav = (component, version) => nav[`${version}@${component}`]
    const tree = buildSiteNavigation(mockCatalog([gk]), getNav, 'general-knowledge', '', {
      include: ['general-knowledge'],
    })

    assert.deepEqual(
      tree[0].items.map((i) => i.content),
      ['Overview', 'Changelog', 'Tutorials', 'How-to Guides', 'Reference', 'Explanation']
    )
  })

  it('keeps titled multi-origin platform trees as siblings under Platforms', () => {
    const platforms = {
      name: 'platforms',
      title: 'Platforms',
      latest: { version: '', url: '/platforms/', title: 'Platforms' },
      versions: [{ version: '', url: '/platforms/', title: 'Platforms' }],
    }
    const nav = {
      '@platforms': [
        {
          content: 'DevCentr',
          items: [
            { content: 'Home', url: '/platforms/devcentr/' },
            { content: 'Changelog', url: '/platforms/devcentr/changelog/' },
            { content: 'Capabilities', url: '/platforms/devcentr/capabilities/' },
          ],
        },
        {
          content: 'devcentr.org',
          items: [
            { content: 'Home', url: '/platforms/devcentr-org/' },
            { content: 'Changelog', url: '/platforms/devcentr-org/changelog/' },
          ],
        },
      ],
    }
    const getNav = (component, version) => nav[`${version}@${component}`]
    const tree = buildSiteNavigation(mockCatalog([platforms]), getNav, 'platforms', '', {
      include: ['platforms'],
    })

    assert.equal(tree.length, 1)
    assert.equal(tree[0].content, 'Platforms')
    assert.equal(tree[0].url, '/platforms/')
    assert.deepEqual(
      tree[0].items.map((i) => i.content),
      ['Overview', 'DevCentr', 'devcentr.org']
    )
    assert.equal(tree[0].items[0].url, '/platforms/')
    assert.deepEqual(
      tree[0].items[1].items.map((i) => i.content),
      ['Home', 'Changelog', 'Capabilities']
    )
  })

  it('ensureOverviewChild is a no-op when Overview already present', () => {
    const items = [
      { content: 'Overview', url: '/bb/' },
      { content: 'Email', url: '/bb/email/' },
    ]
    assert.deepEqual(
      ensureOverviewChild(items, '/bb/').map((i) => i.content),
      ['Overview', 'Email']
    )
  })
})
