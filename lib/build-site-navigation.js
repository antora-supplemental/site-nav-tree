'use strict'

/**
 * Build a site-wide navigation forest: one root item per component, each
 * wrapping that component version's existing nav trees as children.
 *
 * Reuses the default Antora nav-item shape so Valentus / Default UI `nav-tree`
 * and `01-nav.js` keep working — no UI wipe.
 */

function normalizeList (value) {
  if (value == null || value === '') return []
  return (Array.isArray(value) ? value : String(value).split(','))
    .map((it) => String(it).trim())
    .filter(Boolean)
}

function orderComponents (components, { order, exclude }) {
  const excludeSet = new Set(exclude)
  const remaining = components.filter((c) => !excludeSet.has(c.name))
  if (!order.length) return remaining

  const byName = new Map(remaining.map((c) => [c.name, c]))
  const ordered = []
  for (const name of order) {
    const hit = byName.get(name)
    if (hit) {
      ordered.push(hit)
      byName.delete(name)
    }
  }
  for (const c of remaining) {
    if (byName.has(c.name)) ordered.push(c)
  }
  return ordered
}

function resolveComponentVersion (contentCatalog, component, preferredVersion) {
  if (preferredVersion != null) {
    const match = contentCatalog.getComponentVersion(component, preferredVersion)
    if (match) return match
  }
  return component.latest
}

/**
 * @param {object} contentCatalog Antora content catalog
 * @param {(component: string, version: string) => Array|undefined} getNavigation unbound original getter
 * @param {string} currentComponent
 * @param {string} currentVersion
 * @param {{ order?: string[], exclude?: string[] }} config
 */
function buildSiteNavigation (contentCatalog, getNavigation, currentComponent, currentVersion, config = {}) {
  const order = normalizeList(config.order)
  const exclude = normalizeList(config.exclude)
  const components = orderComponents(contentCatalog.getComponentsSortedBy('title'), { order, exclude })
  const roots = []

  for (const component of components) {
    // Prefer the viewer's version when that component publishes it; else latest.
    let cv = resolveComponentVersion(contentCatalog, component, currentVersion)
    let trees = cv ? getNavigation(component.name, cv.version) : undefined

    if ((!trees || !trees.length) && component.latest && (!cv || cv !== component.latest)) {
      cv = component.latest
      trees = getNavigation(component.name, cv.version)
    }
    if (!cv) continue

    const items = Array.isArray(trees) && trees.length ? trees : undefined
    roots.push({
      content: component.title || component.name,
      url: cv.url,
      urlType: 'internal',
      items,
    })
  }

  return roots
}

module.exports = { buildSiteNavigation, orderComponents, normalizeList, resolveComponentVersion }
