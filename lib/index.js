'use strict'

const { buildSiteNavigation, normalizeList } = require('./build-site-navigation')

/**
 * Antora extension: fold all components into `page.navigation`.
 *
 * Strategy: wrap `NavigationCatalog#getNavigation` after `navigationBuilt` so
 * `composePage` / `attachNavProperties` still run the stock path. Default
 * `nav-tree` partial + UI nav script keep working.
 *
 * Optional Valentus companion: copy `ui/partials/nav-menu.hbs` into
 * supplemental-ui to drop the redundant current-component title line.
 */

module.exports.register = function ({ config }) {
  const order = normalizeList(config.order)
  const exclude = normalizeList(config.exclude)
  const logger = this.getLogger('@antora-supplemental/site-nav-tree')

  this.on('playbookBuilt', ({ playbook }) => {
    const keys = playbook.site.keys || (playbook.site.keys = {})
    keys.site_nav_tree = keys.site_nav_tree || 'true'
  })

  this.on('navigationBuilt', ({ contentCatalog, navigationCatalog }) => {
    if (typeof navigationCatalog.getNavigation !== 'function') {
      logger.warn('navigationCatalog.getNavigation missing; site-nav-tree skipped')
      return
    }

    const originalGet = navigationCatalog.getNavigation.bind(navigationCatalog)
    navigationCatalog.getNavigation = (component, version) =>
      buildSiteNavigation(contentCatalog, originalGet, component, version, { order, exclude })

    logger.info(
      'Wrapped navigation catalog: sidebar tree includes all components (default nav-tree behavior retained)'
    )
  })
}
