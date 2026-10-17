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

function item ({ label, href, kids = [] }) {
  const li = new El('LI', { cls: ['nav-item'] })
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

function load (menu) {
  const listeners = []
  const store = {}
  const win = {
    location: { href: 'http://x/docs/a/', pathname: '/docs/a/' },
    addEventListener () {},
    setTimeout,
    clearTimeout,
  }
  const doc = {
    querySelector: (sel) => (sel === '.nav-container [data-panel=menu]' ? menu : null),
    documentElement: new El('HTML'),
    addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture: !!capture }),
  }
  const ctx = {
    window: win,
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
  return { win, listeners, store }
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

function setup (rootItem) {
  const menu = new El('DIV')
  menu.append(new El('UL', { cls: ['nav-list'] }).append(rootItem))
  const { win, listeners, store } = load(menu)
  const label = listeners.find((l) => l.type === 'click' && l.capture)
  return { menu, win, store, onLabelClick: label && label.fn }
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

test('unlinked section label expands and activates Overview anchor', () => {
  const ov = item({ label: 'Overview', href: '/docs/a/' })
  const core = item({ label: 'Core', kids: [ov] })
  const { onLabelClick, store } = setup(core)
  const e = event(core.children[1])
  onLabelClick(e)
  assert.ok(core.classList.contains('is-active'))
  assert.equal(ov.children[0].clicks, 1)
  assert.ok(e.stopped, 'stock toggle suppressed so label never collapses')
  assert.ok(store['site-nav-tree:expanded-v2'])
})

test('linked component root expands and lets its own link navigate', () => {
  const ov = item({ label: 'Overview', href: '/docs/a/' })
  const root = item({ label: 'Demo pages', href: '/docs/a/', kids: [ov] })
  const { onLabelClick } = setup(root)
  const e = event(root.children[1].children[0])
  onLabelClick(e)
  assert.ok(root.classList.contains('is-active'))
  assert.equal(e.prevented, false)
  assert.equal(ov.children[0].clicks, 0)
})

test('linked parent whose URL differs from Overview redirects to Overview', () => {
  const ov = item({ label: 'Overview', href: '/docs/a/' })
  const root = item({ label: 'Tools', href: '/docs/a/other.html', kids: [ov] })
  const { onLabelClick } = setup(root)
  const e = event(root.children[1].children[0])
  onLabelClick(e)
  assert.ok(e.prevented)
  assert.equal(ov.children[0].clicks, 1)
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
