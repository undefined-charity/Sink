// undefined-charity fork: URL handling shared by the event page renderer and sanitiser.

export interface EventPageRenderOptions {
  slug: string
  /** Public URL of the page itself (canonical / og:url). */
  pageUrl: string
  /** Origin that serves /_assets uploads and /event theme files, e.g. https://puppy.events */
  assetOrigin: string
  /** Public URL for a slug (the multi-domain mapping). */
  shortUrl: (slug: string) => string
  /** Leave event-relative "/rsvp" targets as written (editor round-trips). */
  keepRelative?: boolean
}

const SAFE_URL = /^(?:https?:|mailto:|tel:)/i

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function resolveEventHref(href: string, options: EventPageRenderOptions): string | undefined {
  const value = href.trim()
  if (value.startsWith('/_assets/') || value.startsWith('/event/'))
    return `${options.assetOrigin}${value}`
  if (options.keepRelative && value.startsWith('/') && !value.startsWith('//'))
    return value
  if (value.startsWith('/') && !value.startsWith('//')) {
    const path = value.split(/[?#]/)[0]!.split('/').filter(Boolean).join('-').toLowerCase()
    return path ? options.shortUrl(`${options.slug}-${path}`) : options.pageUrl
  }
  if (value.startsWith('#'))
    return value
  return SAFE_URL.test(value) ? value : undefined
}
