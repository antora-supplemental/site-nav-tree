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

function normalizeUrl (url) {
  if (url == null || url === '') return ''
  let u = String(url).split(/[?#]/)[0]
  u = u.replace(/\/index\.html$/i, '/')
  if (u.length > 1) u = u.replace(/\/+$/, '/') || '/'
  return u
}

function navLabel (item) {
  return String((item && item.content) || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Home / Overview landing links (component start page under a forest root). */
function isHomeNavItem (item) {
  if (!item) return false
  const text = navLabel(item)
  return text === 'home' || text === 'overview'
}

/** Changelog / activity-log siblings (keep in sync with nav-typology). */
function isChangelogNavItem (item) {
  if (!item) return false
  const url = normalizeUrl(item.url).toLowerCase()
  const text = navLabel(item)
  if (/\/changelog(\/|$)/.test(url)) return true
  if (/\/activity-log(\/|$)/.test(url)) return true
  if (/^changelog\b/.test(text) || text === 'activity log') return true
  return false
}

/**
 * Hard-sort each branch: Home/Overview first, then Activity Log/Changelog, then rest.
 * Recurses into children so nested platform trees get the same order.
 */
function hardSortHomeThenChangelog (items) {
  if (!Array.isArray(items) || !items.length) return items
  const home = []
  const changelog = []
  const rest = []
  for (const item of items) {
    if (!item) continue
    const copy =
      Array.isArray(item.items) && item.items.length
        ? { ...item, items: hardSortHomeThenChangelog(item.items) }
        : item
    if (isHomeNavItem(copy)) home.push(copy)
    else if (isChangelogNavItem(copy)) changelog.push(copy)
    else rest.push(copy)
  }
  return home.concat(changelog, rest)
}

/**
 * Antora `getNavigation` often returns one anonymous tree `{ items: [...] }`
 * with no content/url. Wrapping that under a component root creates an empty
 * depth-1 folder that never gets `is-active` when the component root itself is
 * `is-current-page` — children look missing. Flatten that wrapper away.
 */
function flattenNavTrees (trees) {
  if (!Array.isArray(trees) || !trees.length) return undefined
  if (trees.length === 1) {
    const only = trees[0]
    if (only && !only.content && !only.url && Array.isArray(only.items)) {
      return only.items
    }
  }
  return trees
}

/**
 * Start-page duplicate under a site-nav-tree component root:
 * - Leaf matching component URL/title → keep as **Overview** (do not drop).
 * - Linked parent matching start URL → promote children, prepend Overview.
 * Avoids Business Bootstrap > Business Bootstrap while retaining an Overview child
 * for hard-sort and component-root affordances.
 * Prefer **Overview** over **Home** so the label does not collide with a Home forest root.
 */
function unwrapStartPageDuplicate (items, componentUrl, componentTitle) {
  if (!Array.isArray(items) || !items.length) return items
  const first = items[0]
  if (!first) return items
  const urlMatch =
    first.url && componentUrl && normalizeUrl(first.url) === normalizeUrl(componentUrl)
  const titleMatch =
    first.content && componentTitle && String(first.content) === String(componentTitle)
  if (!urlMatch && !titleMatch) return items

  const overviewUrl = first.url || componentUrl
  const overviewLeaf = {
    content: 'Overview',
    url: overviewUrl,
    urlType: first.urlType || 'internal',
  }

  // Leaf start-page link: rename to Overview (root already links to the start page).
  if (!first.items || !first.items.length) {
    return [overviewLeaf].concat(items.slice(1))
  }

  // Linked parent that is also the start page: promote its children, keep Overview.
  if (urlMatch) return [overviewLeaf].concat(first.items, items.slice(1))
  return items
}

/**
 * When the component root already links to the start page but nav.adoc has no
 * Home/Overview child, prepend an Overview leaf for discoverability/parity.
 */
function ensureOverviewChild (items, componentUrl) {
  if (!componentUrl) return items
  const list = Array.isArray(items) ? items.slice() : []
  if (list.some(isHomeNavItem)) return list
  return [
    {
      content: 'Overview',
      url: componentUrl,
      urlType: 'internal',
    },
  ].concat(list)
}


/**
 * Curate + order components for the site forest.
 *
 * - `include` (allowlist): when non-empty, only these names appear. Preferred for
 *   hubs that wire many product repos as sources but only want a few roots.
 * - `exclude`: always dropped (even if listed in include).
 * - `order`: pin first; if empty and `include` is set, `include` order is used.
 *   Remaining included components stay title-sorted after the pinned ones.
 */
function orderComponents (components, { order, exclude, include }) {
  const excludeSet = new Set(exclude)
  const includeList = include || []
  const includeSet = includeList.length ? new Set(includeList) : null
  let remaining = components.filter((c) => !excludeSet.has(c.name))
  if (includeSet) {
    remaining = remaining.filter((c) => includeSet.has(c.name))
  }

  const effectiveOrder = order.length ? order : includeList
  if (!effectiveOrder.length) return remaining

  const byName = new Map(remaining.map((c) => [c.name, c]))
  const ordered = []
  for (const name of effectiveOrder) {
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
 * Point the component root at its Overview/Home child URL when present so the forest
 * "button" / breadcrumb target matches the Overview landing (same URL today, but
 * keeps roots honest if Overview ever diverges).
 */
function preferHomeChildUrl (root) {
  if (!root || !Array.isArray(root.items)) return root
  const home = root.items.find(isHomeNavItem)
  if (home && home.url) {
    return { ...root, url: home.url, urlType: home.urlType || root.urlType || 'internal' }
  }
  return root
}

/**
 * @param {object} contentCatalog Antora content catalog
 * @param {(component: string, version: string) => Array|undefined} getNavigation unbound original getter
 * @param {string} currentComponent
 * @param {string} currentVersion
 * @param {{ order?: string[], exclude?: string[], include?: string[] }} config
 */
function buildSiteNavigation (contentCatalog, getNavigation, currentComponent, currentVersion, config = {}) {
  const order = normalizeList(config.order)
  const exclude = normalizeList(config.exclude)
  const include = normalizeList(config.include)
  const components = orderComponents(contentCatalog.getComponentsSortedBy('title'), {
    order,
    exclude,
    include,
  })
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

    const title = component.title || component.name
    let items = flattenNavTrees(Array.isArray(trees) && trees.length ? trees : undefined)
    items = unwrapStartPageDuplicate(items, cv.url, title)
    items = ensureOverviewChild(items, cv.url)
    items = hardSortHomeThenChangelog(items)

    const root = preferHomeChildUrl({
      content: title,
      url: cv.url,
      urlType: 'internal',
      items: items && items.length ? items : undefined,
    })
    roots.push(root)
  }

  return roots
}

module.exports = {
  buildSiteNavigation,
  orderComponents,
  normalizeList,
  normalizeUrl,
  flattenNavTrees,
  unwrapStartPageDuplicate,
  ensureOverviewChild,
  hardSortHomeThenChangelog,
  isHomeNavItem,
  isChangelogNavItem,
  preferHomeChildUrl,
  resolveComponentVersion,
}
