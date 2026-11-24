'use strict'

const fs = require('node:fs')
const path = require('node:path')

const CONTRACT = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'style-contract.json'), 'utf8')
)

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/

/**
 * Validate a site-nav-tree theme stylesheet against style-contract.json.
 *
 * Rules:
 * - No @import or external http(s):// url() references.
 * - Theme selectors must target declared [data-snt-part="..."] / [data-snt-theme="..."] /
 *   [data-snt-state="..."] hooks — no private internal classes (.nav-item, .nav-link, etc.).
 * - Custom property declarations must use the --snt-* namespace and appear in allowedTokens.
 * - Layout invariants on `tree` and `panel` (overflow / overflow-x / overflow-y) cannot be overridden.
 * - Literal colors outside var() / color-mix() produce warnings (errors in strict mode).
 *
 * @param {string} css
 * @param {{ strict?: boolean }} [opts]
 */
function validateThemeCss (css, { strict = false } = {}) {
  const errors = []
  const warnings = []
  const src = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '')

  if (/@import\b/i.test(src)) {
    errors.push('@import is not allowed in a site-nav-tree theme')
  }
  for (const m of src.matchAll(/url\(\s*['"]?(https?:)?\/\//gi)) {
    errors.push(`external url() is not allowed: ${m[0]}`)
  }

  const allowedParts = new Set(CONTRACT.allowedParts)
  const allowedStates = new Set(CONTRACT.allowedStates)
  const allowedTokens = new Set(CONTRACT.allowedTokens)
  const forbiddenInThemes = CONTRACT.forbiddenInThemes || {}

  for (const m of src.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    const rawHeader = m[1].trim()
    const body = m[2]
    if (!rawHeader || rawHeader.startsWith('@')) continue

    const selectors = rawHeader.split(',').map((s) => s.trim()).filter(Boolean)
    const targetedParts = new Set()

    for (const sel of selectors) {
      const bare = sel.replace(/:(?:is|where|not)\(([^()]|\([^()]*\))*\)/g, '')
      // Reject private class or ID selectors in strict Style API themes.
      for (const cls of bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
        errors.push(`selector "${sel}": private class .${cls[1]} is forbidden; use [${CONTRACT.partAttribute}="..."]`)
      }
      for (const id of bare.matchAll(/#([a-zA-Z][\w-]*)/g)) {
        errors.push(`selector "${sel}": private id #${id[1]} is forbidden; use [${CONTRACT.partAttribute}="..."]`)
      }

      const partMatches = [...sel.matchAll(/\[data-snt-part\s*=\s*['"]?([^'"\]]+)['"]?\]/g)]
      if (!partMatches.length) {
        errors.push(`selector "${sel}": must target a declared [${CONTRACT.partAttribute}="..."] hook`)
      }
      for (const pm of partMatches) {
        const part = pm[1].trim()
        targetedParts.add(part)
        if (!allowedParts.has(part)) {
          errors.push(`selector "${sel}": unknown part "${part}"`)
        }
      }

      for (const sm of sel.matchAll(/\[data-snt-state\s*=\s*['"]?([^'"\]]+)['"]?\]/g)) {
        const state = sm[1].trim()
        if (!allowedStates.has(state)) {
          errors.push(`selector "${sel}": unknown state "${state}"`)
        }
      }
    }

    for (const decl of body.split(';')) {
      const idx = decl.indexOf(':')
      if (idx < 0) continue
      const prop = decl.slice(0, idx).trim()
      const value = decl.slice(idx + 1).trim()
      if (!prop) continue

      if (prop.startsWith('--')) {
        if (!allowedTokens.has(prop)) {
          errors.push(`unknown token "${prop}" (not in site-nav-tree style-contract.json)`)
        }
      } else {
        for (const part of targetedParts) {
          const banned = forbiddenInThemes[part] || []
          if (banned.includes(prop)) {
            errors.push(`property "${prop}" is forbidden on part "${part}" (layout invariant)`)
          }
        }
        const withoutSvg = value.replace(/url\(["']?data:image\/svg\+xml[^)]*\)/gi, '')
        if (COLOR_LITERAL.test(withoutSvg)) {
          warnings.push(`literal color in "${prop}: ${value}" (prefer --cs-* / --valentus-* / --snt-* tokens)`)
        }
      }
    }
  }

  const dedupErrors = [...new Set(errors)]
  const dedupWarnings = [...new Set(warnings)]
  const finalErrors = strict ? [...dedupErrors, ...dedupWarnings] : dedupErrors
  const finalWarnings = strict ? [] : dedupWarnings
  return {
    ok: finalErrors.length === 0,
    contract: CONTRACT.contract,
    version: CONTRACT.version,
    errors: finalErrors,
    warnings: finalWarnings,
  }
}

module.exports = { CONTRACT, validateThemeCss }
