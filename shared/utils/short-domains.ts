// Multi-domain short links (undefined-charity fork).
//
// Links are still stored and redirected by slug. A front Worker maps public
// hostnames onto slugs: `<sub>.<domain>/<path>` -> `<prefix>-<sub>-<path>`,
// and the bare domain -> `<prefix>`. Exactly one domain (the primary) has no
// prefix. These helpers do the same mapping for the dashboard, so links show
// and are created as their public URLs instead of raw slugs.
//
// Configured with NUXT_PUBLIC_SHORT_DOMAINS, a JSON object such as
//   {"puppy.events":{},"seattlenaked.men":{"prefix":"snm"}}
// Unset or invalid means single-domain mode: upstream behaviour, `<origin>/<slug>`.

export interface ShortDomain {
  domain: string
  prefix: string
}

export interface SlugParts {
  domain: ShortDomain
  sub: string
  path: string
}

const LABEL = /^[a-z0-9]+$/

export function parseShortDomains(raw: unknown): ShortDomain[] {
  let value = raw
  if (typeof value === 'string') {
    if (!value.trim())
      return []
    try {
      value = JSON.parse(value)
    }
    catch {
      return []
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return []

  const domains = Object.entries(value as Record<string, { prefix?: unknown }>).map(([domain, options]) => ({
    domain: domain.trim().toLowerCase(),
    prefix: typeof options?.prefix === 'string' ? options.prefix.trim().toLowerCase() : '',
  }))
  // Usable only with exactly one primary (unprefixed) domain and valid prefixes.
  if (domains.filter(d => !d.prefix).length !== 1 || domains.some(d => d.prefix && !LABEL.test(d.prefix)))
    return []
  // Primary first, then the rest by name, for pickers and filters.
  return domains.sort((a, b) => Number(!!a.prefix) - Number(!!b.prefix) || a.domain.localeCompare(b.domain))
}

export function primaryShortDomain(domains: ShortDomain[]): ShortDomain | undefined {
  return domains.find(d => !d.prefix)
}

/** Which domain a slug belongs to: the one whose prefix it carries, else the primary. */
export function slugShortDomain(slug: string, domains: ShortDomain[]): ShortDomain | undefined {
  const lower = slug.toLowerCase()
  return domains.find(d => d.prefix && (lower === d.prefix || lower.startsWith(`${d.prefix}-`)))
    ?? primaryShortDomain(domains)
}

export function splitSlug(slug: string, domains: ShortDomain[]): SlugParts | undefined {
  const domain = slugShortDomain(slug, domains)
  if (!domain)
    return undefined
  const lower = slug.toLowerCase()
  const rest = domain.prefix ? lower.slice(domain.prefix.length + 1) : lower
  const [sub = '', ...path] = rest ? rest.split('-') : []
  return { domain, sub, path: path.join('-') }
}

/** Public URL for a slug, e.g. snm-cagecheck -> https://cagecheck.seattlenaked.men */
export function slugToShortUrl(slug: string, domains: ShortDomain[], fallbackOrigin: string): string {
  const parts = splitSlug(slug, domains)
  if (!parts)
    return `${fallbackOrigin}/${slug}`
  const host = parts.sub ? `${parts.sub}.${parts.domain.domain}` : parts.domain.domain
  return `https://${host}${parts.path ? `/${parts.path}` : ''}`
}

export function withoutScheme(url: string): string {
  return url.replace(/^https?:\/\//, '')
}

/**
 * Slug for a domain + subdomain + path. Path slashes become hyphens, matching
 * the front Worker. Returns '' for the primary domain's bare root (that is the
 * site home page, not a link).
 */
export function buildSlug(domain: ShortDomain, sub: string, path: string): string {
  const pathPart = path.trim().toLowerCase().split('/').filter(Boolean).join('-')
  return [domain.prefix, sub.trim().toLowerCase(), pathPart].filter(Boolean).join('-')
}

/** Subdomains are single labels without hyphens so a slug always reads back to one URL. */
export function isValidShortSubdomain(sub: string): boolean {
  return sub === '' || LABEL.test(sub.trim().toLowerCase())
}
