/**
 * Prefer the deepest is-current-page when site-nav-tree inlines many components.
 * Default UI expands only the first match; a duplicated start-page URL on the
 * component root then leaves children behind an inactive anonymous wrapper.
 */
;(function () {
  'use strict'
  var menu = document.querySelector('.nav-container [data-panel=menu]')
  if (!menu) return

  var currents = [].slice.call(menu.querySelectorAll('.nav-item.is-current-page'))
  if (!currents.length) return

  currents.sort(function (a, b) {
    return (parseInt(b.getAttribute('data-depth'), 10) || 0) - (parseInt(a.getAttribute('data-depth'), 10) || 0)
  })
  var best = currents[0]

  currents.forEach(function (el) {
    if (el !== best) el.classList.remove('is-current-page')
  })

  menu.querySelectorAll('.nav-item.is-active, .nav-item.is-current-path').forEach(function (el) {
    el.classList.remove('is-active', 'is-current-path')
  })

  var node = best
  while (node && !(node.classList && node.classList.contains('nav-menu'))) {
    if (node.tagName === 'LI' && node.classList.contains('nav-item')) {
      node.classList.add('is-active', 'is-current-path')
    }
    node = node.parentNode
  }
  best.classList.add('is-active', 'is-current-page')
})()
