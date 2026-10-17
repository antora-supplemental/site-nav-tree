/**
 * Local DOM filter for the left nav tree (no search index).
 * Toggle via extension config `filter: true` or `filter: { enabled: true }`.
 * Re-applies after SoftNav when the panel is not swapped (`swapNav: false`).
 */
;(function () {
  'use strict'

  var DEBOUNCE_MS = 180
  var PANEL = '.nav-container [data-panel=menu]'
  var FILTER_ATTR = 'data-nav-filter-hidden'
  var OPEN_ATTR = 'data-nav-filter-open'

  function debounce (fn, ms) {
    var t
    return function () {
      var self = this
      var args = arguments
      window.clearTimeout(t)
      t = window.setTimeout(function () {
        fn.apply(self, args)
      }, ms)
    }
  }

  function menuNav (panel) {
    return panel ? panel.querySelector('nav.nav-menu') : null
  }

  function itemLabel (item) {
    var link = item.querySelector(':scope > a.nav-link')
    if (link) {
      var text = link.querySelector('.nav-text')
      return (text || link).textContent.replace(/\s+/g, ' ').trim()
    }
    var span = item.querySelector(':scope > .nav-text')
    return span ? span.textContent.replace(/\s+/g, ' ').trim() : ''
  }

  function clearFilter (nav) {
    if (!nav) return
    nav.querySelectorAll('[' + FILTER_ATTR + ']').forEach(function (el) {
      el.removeAttribute(FILTER_ATTR)
      el.classList.remove('nav-tree-filter-hidden')
    })
    nav.querySelectorAll('[' + OPEN_ATTR + ']').forEach(function (el) {
      el.removeAttribute(OPEN_ATTR)
      el.classList.remove('is-active')
    })
  }

  function applyFilter (nav, rawQuery) {
    if (!nav) return
    var q = (rawQuery || '').trim().toLowerCase()
    clearFilter(nav)
    if (!q) return

    var items = nav.querySelectorAll('li.nav-item')
    var matchByItem = new Map()
    var sorted = [].slice.call(items).sort(function (a, b) {
      var da = parseInt(a.getAttribute('data-depth'), 10) || 0
      var db = parseInt(b.getAttribute('data-depth'), 10) || 0
      return db - da
    })

    sorted.forEach(function (item) {
      var selfMatch = itemLabel(item).toLowerCase().indexOf(q) >= 0
      var childMatch = false
      var childList = item.querySelector(':scope > ul.nav-list')
      if (childList) {
        [].some.call(childList.children, function (child) {
          if (child.matches && child.matches('li.nav-item') && matchByItem.get(child)) {
            childMatch = true
            return true
          }
          return false
        })
      }
      var visible = selfMatch || childMatch
      matchByItem.set(item, visible)
      if (!visible) {
        item.setAttribute(FILTER_ATTR, '1')
        item.classList.add('nav-tree-filter-hidden')
      } else if (childMatch && item.querySelector(':scope > .nav-item-toggle')) {
        if (!item.classList.contains('is-active')) {
          item.classList.add('is-active')
          item.setAttribute(OPEN_ATTR, '1')
        }
      }
    })
  }

  function filterInput (panel) {
    if (!panel) return null
    return panel.querySelector('[data-nav-tree-filter]')
  }

  function ensureFilterInput (panel) {
    if (!panel || filterInput(panel)) return filterInput(panel)
    var wrap = document.createElement('div')
    wrap.className = 'nav-tree-filter'
    var input = document.createElement('input')
    input.className = 'nav-tree-filter-input'
    input.type = 'search'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('aria-label', 'Filter navigation')
    input.placeholder = 'Filter navigation…'
    input.setAttribute('data-nav-tree-filter', '')
    wrap.appendChild(input)
    panel.insertBefore(wrap, panel.firstChild)
    return input
  }

  function bindPanel (panel) {
    if (!panel || panel.getAttribute('data-nav-tree-filter-bound') === '1') return
    var nav = menuNav(panel)
    if (!nav) return
    var input = filterInput(panel) || ensureFilterInput(panel)
    if (!input) return

    var run = debounce(function () {
      applyFilter(nav, input.value)
    }, DEBOUNCE_MS)

    input.addEventListener('input', run)
    input.addEventListener('search', function () {
      if (!input.value) applyFilter(nav, '')
    })
    panel.setAttribute('data-nav-tree-filter-bound', '1')
  }

  function init () {
    bindPanel(document.querySelector(PANEL))
  }

  function reapplyAfterNav () {
    var panel = document.querySelector(PANEL)
    if (!panel) return
    bindPanel(panel)
    var nav = menuNav(panel)
    var input = filterInput(panel)
    if (nav && input && input.value.trim()) applyFilter(nav, input.value)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  if (window.SoftNav && typeof window.SoftNav.on === 'function') {
    window.SoftNav.on('loaded', reapplyAfterNav)
  } else {
    document.addEventListener('soft-nav:loaded', reapplyAfterNav)
  }
})()
