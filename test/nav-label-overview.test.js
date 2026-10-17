'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const SRC = fs.readFileSync(path.join(__dirname, '..', 'ui', 'js', 'site-nav-tree-current.js'), 'utf8')

/** Minimal DOM double: just enough tree + classList for the label-click logic. */
class El {
  constructor (tagName, { cls = [], attrs = {}, text = '' } = {}) {
    this.tagName = tagName
    this.children = []
    this.parentNode = null
    this._attrs = { ...attrs }
    this._text = text
    const set = new Set(cls)
    this.classList = {
      add: (...c) => c.forEach((x) => set.add(x)),
      remove: (...c) => c.forEach((x) => set.delete(x)),
      contains: (c) => set.has(c),
      toggle: (c) => (set.has(c) ? (set.delete(c), false) : (set.add(c), true)),
    }
    this.clicks = 0
  }

  append (...kids) {
    kids.forEach((k) => {
      k.parentNode = this
      this.children.push(k)
    })
    return this
  }

  get textContent () {
    return this._text + this.children.map((c) => c.textContent).join('')
  }

  get parentElement () {
    return this.parentNode
  }

  getAttribute (n) {
    return n in this._attrs ? this._attrs[n] : null
  }

  setAttribute (n, v) {
    this._attrs[n] = v
  }

  contains (el) {
    for (let n = el; n; n = n.parentNode) if (n === this) return true
    return false
  }

  closest (sel) {
    const parts = sel.split(',').map((s) => s.trim())
    for (let n = this; n; n = n.parentNode) {
      if (parts.some((p) => matches(n, p))) return n
    }
    return null
  }

  click () {
    this.clicks++
  }

  addEventListener () {}

  querySelectorAll (sel) {
    const direct = /^:scope\s*>\s*/.test(sel)
    const parts = sel.replace(/^:scope\s*>\s*/, '').split(',').map((s) => s.trim())
    const out = []
    const walk = (n, top) => {
      n.children.forEach((c) => {
        if (parts.some((p) => matches(c, p))) out.push(c)
        if (!direct) walk(c, false)
      })
    }
    walk(this, true)
    return out
  }

  querySelector (sel) {
    return this.querySelectorAll(sel)[0] || null
  }
}

function matches (el, sel) {
  const m = /^([a-z]*)((?:\.[\w-]+)*)$/i.exec(sel)
  if (!m) return false
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false
  return m[2]
    .split('.')
    .filter(Boolean)
    .every((c) => el.classList.contains(c))
}

function item ({ label, href, kids = [], depth = null }) {
  const li = new El('LI', { cls: ['nav-item'] })
  if (depth != null) li.setAttribute('data-depth', String(depth))
  if (kids.length) li.append(new El('BUTTON', { cls: ['nav-item-toggle'] }))
  if (href) {
    const a = new El('A', { cls: ['nav-link'], attrs: { href } })
    a.append(new El('SPAN', { cls: ['nav-text'], text: label }))
    li.append(a)
  } else {
    li.append(new El('SPAN', { cls: ['nav-text'], text: label }))
  }
  if (kids.length) li.append(new El('UL', { cls: ['nav-list'] }).append(...kids))
  return li
}

function load (menu, { softNav = null, pathname = '/docs/a/' } = {}) {
  const listeners = []
  const store = {}
  const navigated = []
  const win = {
    location: { href: 'http://x' + pathname, pathname },
    addEventListener () {},
    setTimeout,
    clearTimeout,
    SoftNav: softNav || {
      navigate (url) {
        navigated.push(url)
      },
    },
  }
  const doc = {
    querySelector: (sel) => (sel === '.nav-container [data-panel=menu]' ? menu : null),
    documentElement: new El('HTML'),
    addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture: !!capture }),
  }
  const ctx = {
    window: win,
    SoftNav: win.SoftNav,
    document: doc,
    sessionStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v },
    },
    URL,
    requestAnimationFrame: (f) => f(),
    console,
  }
  win.document = doc
  vm.runInNewContext(SRC, ctx)
  return { win, listeners, store, navigated }
}

function event (target, extra = {}) {
  return {
    target,
    button: 0,
    defaultPrevented: false,
    stopped: false,
    prevented: false,
    stopPropagation () { this.stopped = true },
    preventDefault () { this.prevented = true },
    ...extra,
  }
}

function setup (rootItem, opts = {}) {
  const menu = new El('DIV')
  menu.append(new El('UL', { cls: ['nav-list'] }).append(rootItem))
  const { win, listeners, store, navigated } = load(menu, opts)
  const label = listeners.find((l) => l.type === 'click' && l.capture)
  return { menu, win, store, navigated, onLabelClick: label && label.fn }
}

test('overviewLinkFor finds Overview/Home child link only', () => {
  const ov = item({ label: 'Overview', href: '/docs/a/' })
  const li = item({ label: 'Core', kids: [ov, item({ label: 'Other', href: '/docs/a/x.html' })] })
  const { win } = setup(li)
  assert.equal(win.siteNavTreeOverviewLink(li), ov.children[0])
  assert.equal(win.siteNavTreeOverviewLink(item({ label: 'Leaf', href: '/docs/a/y.html' })), null)
  const noOv = item({ label: 'Sec', kids: [item({ label: 'Page', href: '/docs/a/p.html' })] })
  assert.equal(win.siteNavTreeOverviewLink(noOv), null)
})

test('unlinked section label expands and opens Overview via SoftNav', () => {
  const ov = item({ label: 'Overview', href: '/docs/a/' })
  const core = item({ label: 'Core', kids: [ov] })
  const { onLabelClick, store, navigated } = setup(core, { pathname: '/docs/other/' })
  const e = event(core.children[1])
  onLabelClick(e)
  assert.ok(core.classList.contains('is-active'))
  assert.ok(core.classList.contains('snt-overview-label'))
  assert.equal(ov.children[0].clicks, 0)
  assert.equal(navigated.length, 1)
  assert.ok(e.stopped, 'stock toggle suppressed so label never collapses')
  assert.ok(store['site-nav-tree:expanded-v2'])
})

test('linked component root expands and lets its own link navigate', () => {
  const ov = item({ label: 'Overview', href: '/docs/a/' })
  const root = item({ label: 'Demo pages', href: '/docs/a/', kids: [ov] })
  const { onLabelClick } = setup(root, { pathname: '/docs/other/' })
  const e = event(root.children[1].children[0])
  onLabelClick(e)
  assert.ok(root.classList.contains('is-active'))
  assert.equal(e.prevented, false)
  assert.equal(ov.children[0].clicks, 0)
})

test('linked parent whose URL differs from Overview redirects to Overview', () => {
  const ov = item({ label: 'Overview', href: '/docs/a/' })
  const root = item({ label: 'Tools', href: '/docs/a/other.html', kids: [ov] })
  const { onLabelClick, navigated } = setup(root, { pathname: '/docs/a/other.html' })
  const e = event(root.children[1].children[0])
  onLabelClick(e)
  assert.ok(e.prevented)
  assert.equal(ov.children[0].clicks, 0)
  assert.equal(navigated.length, 1)
})

test('linked root on Overview page expands without redundant navigation', () => {
  const ov = item({ label: 'Overview', href: '/docs/a/' })
  const root = item({ label: 'Demo pages', href: '/docs/a/', kids: [ov] })
  const { onLabelClick, navigated } = setup(root)
  const e = event(root.children[1].children[0])
  onLabelClick(e)
  assert.ok(root.classList.contains('is-active'))
  assert.ok(e.prevented)
  assert.equal(navigated.length, 0)
  assert.equal(ov.children[0].clicks, 0)
})

test('absolutizeNavLinkHrefs freezes nav targets to site pathnames', () => {
  const ov = item({ label: 'Overview', href: 'internet-architecture/' })
  const rel = item({ label: 'Internet Reliability', href: 'internet-architecture/reliability/' })
  const core = item({ label: 'Explanation', kids: [ov, rel] })
  const menu = new El('DIV')
  menu.append(new El('UL', { cls: ['nav-list'] }).append(core))
  const { win } = load(menu, { pathname: '/general-knowledge/explanation/' })
  win.siteNavTreeAbsolutizeNavHrefs(menu, 'https://docs.example/general-knowledge/explanation/')
  assert.equal(ov.children[0].getAttribute('href'), '/general-knowledge/explanation/internet-architecture/')
  assert.equal(rel.children[0].getAttribute('href'), '/general-knowledge/explanation/internet-architecture/reliability/')
})

test('prepareNavMenu keeps forest base after SoftNav depth change', () => {
  const leaf = item({ label: 'Reliability', href: 'internet-architecture/reliability/' })
  const menu = new El('DIV', { attrs: { 'data-snt-nav-base': 'https://docs.example/general-knowledge/explanation/' } })
  menu.append(new El('UL', { cls: ['nav-list'] }).append(leaf))
  const { win } = load(menu, { pathname: '/general-knowledge/explanation/overview/' })
  win.siteNavTreePrepareNavMenu(menu)
  assert.equal(leaf.children[0].getAttribute('href'), '/general-knowledge/explanation/internet-architecture/reliability/')
  assert.equal(menu.getAttribute('data-snt-hrefs-absolutized'), '1')
})

test('siteNavTreeResolveNavLink uses stored base not current pathname', () => {
  const rel = item({ label: 'Reliability', href: 'internet-architecture/reliability/' })
  const menu = new El('DIV', { attrs: { 'data-snt-nav-base': 'https://docs.example/general-knowledge/explanation/' } })
  menu.append(new El('UL', { cls: ['nav-list'] }).append(rel))
  const { win } = load(menu, { pathname: '/general-knowledge/explanation/overview/' })
  const url = win.siteNavTreeResolveNavLink('internet-architecture/reliability/', menu)
  assert.equal(url, 'https://docs.example/general-knowledge/explanation/internet-architecture/reliability/')
})

test('pickBestCurrentPageItem prefers owning component over cross-component xref', () => {
  const gkXref = item({ label: 'General Knowledge', href: '/general-knowledge/', depth: 2 })
  const devcentr = item({
    label: 'DevCentr',
    href: '/platforms/devcentr/',
    depth: 1,
    kids: [gkXref],
  })
  const platforms = item({
    label: 'Platforms',
    href: '/platforms/',
    depth: 0,
    kids: [devcentr],
  })
  const gkOverview = item({ label: 'Overview', href: '/general-knowledge/', depth: 1 })
  const gkRoot = item({
    label: 'General Knowledge',
    href: '/general-knowledge/',
    depth: 0,
    kids: [gkOverview],
  })
  const menu = new El('DIV')
  menu.append(new El('UL', { cls: ['nav-list'] }).append(platforms, gkRoot))
  const { win } = load(menu, { pathname: '/general-knowledge/' })
  const candidates = [platforms, devcentr, gkXref, gkRoot, gkOverview]
  candidates.forEach((li) => li.classList.add('is-current-page'))
  const best = win.siteNavTreePickBestCurrentPageItem(candidates, '/general-knowledge/', menu)
  assert.notEqual(best, gkXref)
  assert.equal(best, gkOverview, 'Overview leaf, not its component root, is the current page')
  assert.equal(win.siteNavTreeComponentRootHref(gkXref), '/platforms/')
  assert.equal(win.siteNavTreeComponentRootHref(gkOverview), '/general-knowledge/')
})

test('siteNavTreeCurrent rewrites duplicate current markers to owning component', () => {
  const gkXref = item({ label: 'General Knowledge', href: '/general-knowledge/', depth: 2 })
  const devcentr = item({ label: 'DevCentr', href: '/platforms/devcentr/', depth: 1, kids: [gkXref] })
  const platforms = item({ label: 'Platforms', href: '/platforms/', depth: 0, kids: [devcentr] })
  const gkOverview = item({ label: 'Overview', href: '/general-knowledge/', depth: 1 })
  const gkRoot = item({
    label: 'General Knowledge',
    href: '/general-knowledge/',
    depth: 0,
    kids: [gkOverview],
  })
  const menu = new El('DIV')
  menu.append(new El('UL', { cls: ['nav-list'] }).append(platforms, gkRoot))
  const { win } = load(menu, { pathname: '/general-knowledge/' })
  ;[gkRoot, gkOverview, gkXref].forEach((li) => li.classList.add('is-current-page'))
  win.siteNavTreeCurrent()
  assert.equal(gkXref.classList.contains('is-current-page'), false)
  assert.equal(gkOverview.classList.contains('is-current-page'), true)
  assert.equal(gkRoot.classList.contains('is-current-page'), false)
  assert.equal(gkRoot.classList.contains('is-current-path'), true)
  assert.equal(platforms.classList.contains('is-current-path'), false)
})

test('siteNavTreeCurrent keeps a single is-current-page when parent and child both marked', () => {
  const child = item({ label: 'Changelog', href: '/platforms/devcentr/changelog/', depth: 2 })
  const devcentr = item({
    label: 'DevCentr',
    href: '/platforms/devcentr/',
    depth: 1,
    kids: [child],
  })
  const platforms = item({ label: 'Platforms', href: '/platforms/', depth: 0, kids: [devcentr] })
  const menu = new El('DIV')
  menu.append(new El('UL', { cls: ['nav-list'] }).append(platforms))
  const { win } = load(menu, { pathname: '/platforms/devcentr/changelog/' })
  devcentr.classList.add('is-current-page')
  child.classList.add('is-current-page')
  win.siteNavTreeCurrent()
  assert.equal(devcentr.classList.contains('is-current-page'), false)
  assert.equal(child.classList.contains('is-current-page'), true)
  assert.equal(devcentr.classList.contains('is-current-path'), true)
})

test('expandForestRootSections opens all depth-1 branches under a forest root', () => {
  const secA = item({ label: 'Explanation', href: '/general-knowledge/explanation/', depth: 1 })
  const secB = item({ label: 'Tutorial', href: '/general-knowledge/tutorial/', depth: 1 })
  const gkRoot = item({
    label: 'General Knowledge',
    href: '/general-knowledge/',
    depth: 0,
    kids: [item({ label: 'Overview', href: '/general-knowledge/', depth: 1 }), secA, secB],
  })
  const menu = new El('DIV')
  menu.append(new El('UL', { cls: ['nav-list'] }).append(gkRoot))
  const { win } = load(menu, { pathname: '/general-knowledge/' })
  win.siteNavTreeExpandForestRootSections(gkRoot)
  assert.ok(secA.classList.contains('is-active'))
  assert.ok(secB.classList.contains('is-active'))
})

test('nodes without Overview, toggles, and modified clicks keep stock behavior', () => {
  const sec = item({ label: 'Sec', kids: [item({ label: 'Page', href: '/docs/a/p.html' })] })
  const { onLabelClick } = setup(sec)
  const e = event(sec.children[1])
  onLabelClick(e)
  assert.equal(sec.classList.contains('is-active'), false)
  assert.equal(e.stopped, false)

  const ov = item({ label: 'Overview', href: '/docs/a/' })
  const core = item({ label: 'Core', kids: [ov] })
  const s2 = setup(core)
  s2.onLabelClick(event(core.children[0])) // caret button
  assert.equal(core.classList.contains('is-active'), false)
  s2.onLabelClick(event(core.children[1], { ctrlKey: true }))
  assert.equal(ov.children[0].clicks, 0)
})
