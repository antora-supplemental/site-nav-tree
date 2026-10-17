'use strict'

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

module.exports = { parseNavFilter, resolveInjectUi }
