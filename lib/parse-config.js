'use strict'

const VALID_THEMES = new Set(['default', 'framed'])

/**
 * @param {Record<string, unknown>} config extension playbook config
 * @returns {boolean}
 */
function parseNavFilter (config) {
  if (config.filter === true || config.navFilter === true || config.navTreeFilter === true) {
    return true
  }
  const filter = config.filter
  if (filter && typeof filter === 'object' && filter.enabled === true) return true
  return false
}

/**
 * Resolve canonical nav-tree theme id ('default' | 'framed').
 * Unknown values fall back to 'default'.
 *
 * @param {Record<string, unknown>} config
 * @returns {'default' | 'framed'}
 */
function parseNavTheme (config) {
  const raw = config && typeof config.theme === 'string' ? config.theme.trim().toLowerCase() : ''
  return VALID_THEMES.has(raw) ? raw : 'default'
}

/**
 * Inject companion UI when explicitly requested or when the nav filter is enabled.
 *
 * @param {Record<string, unknown>} config
 * @param {boolean} navFilter
 * @returns {boolean}
 */
function resolveInjectUi (config, navFilter) {
  if (config.injectUi === false || config.ui === false) return false
  if (config.injectUi === true || config.ui === true) return true
  return navFilter
}

module.exports = { parseNavFilter, parseNavTheme, resolveInjectUi, VALID_THEMES }
