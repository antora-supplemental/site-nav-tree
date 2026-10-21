'use strict'

const { buildSiteNavigation, normalizeList } = require('./build-site-navigation')
const { injectSiteNavTreeStyles, injectSiteNavTreeUi } = require('./inject-ui')
const { parseNavFilter, resolveInjectUi } = require('./parse-config')

/**
 * Antora extension: fold curated components into `page.navigation`.
 *
 * Strategy: wrap `NavigationCatalog#getNavigation` after `navigationBuilt` so
 * `composePage` / `attachNavProperties` still run the stock path. Default
 * `nav-tree` partial + UI nav script keep working.
 *
 * Prefer `include` (allowlist) on multi-source hubs so wiring a product repo as
 * a content source does not auto-add it to the sidebar forest.
 *
 * Optional Valentus companion: copy `ui/partials/nav-menu.hbs` into
 * supplemental-ui to drop the redundant current-component title line.
 */

module.exports.register = function ({ config }) {
  const order = normalizeList(config.order)
  const exclude = normalizeList(config.exclude)
  const include = normalizeList(config.include)
  const navFilter = parseNavFilter(config)
  const injectUi = resolveInjectUi(config, navFilter)
  const logger = this.getLogger('@antora-supplemental/site-nav-tree')

  this.on('playbookBuilt', ({ playbook }) => {
    const keys = playbook.site.keys || (playbook.site.keys = {})
    keys.site_nav_tree = keys.site_nav_tree || 'true'
    if (navFilter) keys.site_nav_tree_filter = 'true'
    // Shared curation for sidebar + breadcrumb picker (comma-separated names).
    keys.site_nav_tree_include = include.join(',')
    keys.site_nav_tree_exclude = exclude.join(',')
    keys.site_nav_tree_order = order.join(',')
  })

  this.on('navigationBuilt', ({ contentCatalog, navigationCatalog }) => {
    if (typeof navigationCatalog.getNavigation !== 'function') {
      logger.warn('navigationCatalog.getNavigation missing; site-nav-tree skipped')
      return
    }

    const originalGet = navigationCatalog.getNavigation.bind(navigationCatalog)
    navigationCatalog.getNavigation = (component, version) =>
      buildSiteNavigation(contentCatalog, originalGet, component, version, {
        order,
        exclude,
        include,
      })

    const mode = include.length
      ? `include allowlist (${include.length})`
      : exclude.length
        ? `all components minus exclude (${exclude.length})`
        : 'all components'
    logger.info(`Wrapped navigation catalog: sidebar forest = ${mode} (default nav-tree retained)`)
  })

  this.on('uiLoaded', ({ playbook, uiCatalog }) => {
    const uiOutputDir = playbook.ui?.outputDir || '_'
    injectSiteNavTreeStyles(uiCatalog, uiOutputDir, { filter: navFilter })
    logger.info(
      `Injected site-nav-tree styles (${navFilter ? 'overview-label, mobile-drawer, nav-tree-filter' : 'overview-label, mobile-drawer'})`
    )
    if (injectUi) {
      injectSiteNavTreeUi(uiCatalog, uiOutputDir, {
        filter: navFilter,
        injectNavMenu: true,
        injectStyles: false,
      })
      logger.info(
        `Injected site-nav-tree UI (nav-menu partial, site-nav-tree-current.js${navFilter ? ', nav-tree-filter.js' : ''})`
      )
    }
  })
}
