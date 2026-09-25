/**
 * Prefer the deepest is-current-page when site-nav-tree inlines many components.
 * Default UI expands only the first match; a duplicated start-page URL on the
 * component root then leaves children behind an inactive anonymous wrapper.
 *
 * Also retains expand/collapse state across page navigations via sessionStorage
 * so opening other component trees is not wiped when the current-path rewrite
 * runs (which clears and re-applies is-active along the active page only).
 *
 * Expand keys use component-absolute pathnames (not relative hrefs) so SoftNav
 * depth changes and absolutize() do not look like inject/remove of the tree.
 *
 * Nav panel scrollTop is persisted separately so left-rail position survives
 * SoftNav swaps and full document loads independently of the content column.
 */
;(function () {
  'use strict'

  // v2: pathname keys (stable across URL depth / SoftNav absolutize)
  var STORAGE_KEY = 'site-nav-tree:expanded-v2'
  var SCROLL_KEY = 'site-nav-tree:scroll-y'

  function normalizeHref (href) {
    if (!href) return ''
    try {
      var u = new URL(href, window.location.href)
      var path = u.pathname || '/'
      path = path.replace(/\/index\.html$/i, '/')
      if (path.length > 1) path = path.replace(/\/+$/, '/') || '/'
      return path
    } catch (e) {
      return String(href).split(/[?#]/)[0]
    }
  }

  function itemKey (el) {
    var link = el.querySelector(':scope > .nav-link')
    var href = link && link.getAttribute('href')
    if (href) return 'h:' + normalizeHref(href)
    var labelEl = el.querySelector(':scope > .nav-text, :scope > .nav-link')
    var label = ((labelEl && labelEl.textContent) || '').trim().replace(/\s+/g, ' ')
    var parts = [(el.getAttribute('data-depth') || '0') + ':' + label]
    var parent = el.parentElement ? el.parentElement.closest('li.nav-item') : null
    while (parent) {
      var plink = parent.querySelector(':scope > .nav-link')
      var phref = plink && plink.getAttribute('href')
      if (phref) {
        parts.unshift('h:' + normalizeHref(phref))
      } else {
        var plabelEl = parent.querySelector(':scope > .nav-text, :scope > .nav-link')
        var plabel = ((plabelEl && plabelEl.textContent) || '').trim().replace(/\s+/g, ' ')
        parts.unshift((parent.getAttribute('data-depth') || '0') + ':' + plabel)
      }
      parent = parent.parentElement ? parent.parentElement.closest('li.nav-item') : null
    }
    return 'p:' + parts.join('/')
  }

  function loadExpanded () {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY)
      var parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  }

  function saveExpanded (keys) {
    try {
      var unique = []
      var seen = Object.create(null)
      keys.forEach(function (k) {
        if (!k || seen[k]) return
        seen[k] = true
        unique.push(k)
      })
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(unique))
    } catch (e) {
      /* private mode / quota - ignore */
    }
  }

  function collectExpanded (menu) {
    return [].slice.call(menu.querySelectorAll('.nav-item.is-active')).map(itemKey)
  }

  function applyExpanded (menu, keys) {
    if (!keys || !keys.length) return
    var want = Object.create(null)
    keys.forEach(function (k) {
      want[k] = true
    })
    menu.querySelectorAll('.nav-item').forEach(function (el) {
      if (want[itemKey(el)]) el.classList.add('is-active')
    })
  }

  function persistMenu (menu) {
    if (!menu) return
    saveExpanded(collectExpanded(menu))
  }

  function navScrollEl () {
    return document.querySelector('.nav-container [data-panel=menu]')
  }

  function saveNavScroll () {
    var el = navScrollEl()
    if (!el) return
    try {
      sessionStorage.setItem(SCROLL_KEY, String(el.scrollTop || 0))
    } catch (e) {
      /* ignore */
    }
  }

  function restoreNavScroll () {
    var el = navScrollEl()
    if (!el) return
    var raw
    try {
      raw = sessionStorage.getItem(SCROLL_KEY)
    } catch (e) {
      return
    }
    if (raw == null || raw === '') return
    var y = parseInt(raw, 10)
    if (isNaN(y)) return
    el.scrollTop = y
    // Layout / font metrics can settle a frame later after SoftNav swaps.
    requestAnimationFrame(function () {
      var again = navScrollEl()
      if (again) again.scrollTop = y
    })
  }

  /**
   * After SoftNav swaps the nav panel, restore remembered expansion *and*
   * the current-page path without collapsing non-current siblings the reader
   * left open under other (or the same) component roots.
   */
  function siteNavTreeCurrent () {
    var menu = document.querySelector('.nav-container [data-panel=menu]')
    if (!menu) return

    var remembered = loadExpanded()

    var currents = [].slice.call(menu.querySelectorAll('.nav-item.is-current-page'))
    if (!currents.length) {
      applyExpanded(menu, remembered)
      persistMenu(menu)
      restoreNavScroll()
      return
    }

    currents.sort(function (a, b) {
      return (parseInt(b.getAttribute('data-depth'), 10) || 0) - (parseInt(a.getAttribute('data-depth'), 10) || 0)
    })
    var best = currents[0]

    currents.forEach(function (el) {
      if (el !== best) el.classList.remove('is-current-page')
    })

    // Drop path markers from a prior page; keep remembered expansions via
    // sessionStorage so SoftNav rebind does not look like inject/remove.
    menu.querySelectorAll('.nav-item.is-current-path').forEach(function (el) {
      el.classList.remove('is-current-path')
    })
    // Clear is-active only along items that will be rebuilt from current path;
    // remembered keys re-apply sibling / other-component expansion next.
    menu.querySelectorAll('.nav-item.is-active').forEach(function (el) {
      el.classList.remove('is-active')
    })

    var node = best
    while (node && !(node.classList && node.classList.contains('nav-menu'))) {
      if (node.tagName === 'LI' && node.classList.contains('nav-item')) {
        node.classList.add('is-active', 'is-current-path')
      }
      node = node.parentNode
    }
    best.classList.add('is-active', 'is-current-page')

    applyExpanded(menu, remembered)
    persistMenu(menu)
    restoreNavScroll()
  }

  function onToggleClick (e) {
    var toggle = e.target && e.target.closest && e.target.closest('.nav-item-toggle')
    if (!toggle) return
    var menu = document.querySelector('.nav-container [data-panel=menu]')
    if (!menu || !menu.contains(toggle)) return
    // Default UI toggles is-active synchronously on click; persist after that.
    setTimeout(function () {
      persistMenu(menu)
    }, 0)
  }

  window.siteNavTreeCurrent = siteNavTreeCurrent
  window.siteNavTreeSaveScroll = saveNavScroll
  window.siteNavTreeRestoreScroll = restoreNavScroll

  document.addEventListener('click', onToggleClick)

  // Persist scroll while the reader moves the left rail; also right before unload
  // so a full navigation (cross-component) keeps the position.
  document.addEventListener(
    'scroll',
    function (e) {
      var el = navScrollEl()
      if (!el) return
      if (e.target === el || (e.target && el.contains(e.target))) saveNavScroll()
    },
    true
  )
  // Some browsers only fire scroll on the element itself (not via capture from document).
  function bindPanelScroll () {
    var el = navScrollEl()
    if (!el || el.getAttribute('data-snt-scroll-bound')) return
    el.setAttribute('data-snt-scroll-bound', '1')
    el.addEventListener('scroll', saveNavScroll, { passive: true })
  }
  bindPanelScroll()
  window.addEventListener('beforeunload', saveNavScroll)
  // Capture nav link clicks early so full navigations remember scroll.
  document.addEventListener(
    'click',
    function (e) {
      var a = e.target && e.target.closest && e.target.closest('a.nav-link')
      if (!a) return
      var panel = navScrollEl()
      if (panel && panel.contains(a)) saveNavScroll()
    },
    true
  )

  siteNavTreeCurrent()
  bindPanelScroll()

  function onSoftNavLoaded (fn) {
    if (window.SoftNav && typeof SoftNav.on === 'function') SoftNav.on('loaded', fn)
    else document.addEventListener('soft-nav:loaded', function (e) { fn(e.detail || {}) })
  }
  function onSoftNavBefore (fn) {
    if (window.SoftNav && typeof SoftNav.on === 'function') SoftNav.on('before', fn)
    else document.addEventListener('soft-nav:before', function (e) { fn(e.detail || {}) })
  }
  onSoftNavBefore(function () {
    saveNavScroll()
  })
  onSoftNavLoaded(function () {
    siteNavTreeCurrent()
    bindPanelScroll()
    restoreNavScroll()
  })
})()