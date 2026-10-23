import type { H3Event } from 'h3'
import type { EventPage } from '#shared/schemas/event-page'
import { EventPageSchema } from '#shared/schemas/event-page'
import { renderEventPageHtml } from '#shared/utils/event-page-render'
import { parseShortDomains, slugToShortUrl } from '#shared/utils/short-domains'

// undefined-charity fork: event pages live in KV next to their link.
const PREFIX = 'event-page:'

function kv(event: H3Event) {
  return event.context.cloudflare.env.KV
}

export async function getEventPage(event: H3Event, slug: string, cacheTtl?: number): Promise<EventPage | null> {
  const raw = await kv(event).get(`${PREFIX}${slug}`, { type: 'json', ...(cacheTtl ? { cacheTtl: Math.max(cacheTtl, 60) } : {}) })
  if (!raw)
    return null
  const parsed = EventPageSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export async function putEventPage(event: H3Event, slug: string, page: EventPage): Promise<void> {
  await kv(event).put(`${PREFIX}${slug}`, JSON.stringify(page))
}

export async function deleteEventPage(event: H3Event, slug: string): Promise<void> {
  await kv(event).delete(`${PREFIX}${slug}`)
}

export async function listEventPageSlugs(event: H3Event): Promise<string[]> {
  const slugs: string[] = []
  let cursor: string | undefined
  do {
    const page = await kv(event).list({ prefix: PREFIX, cursor })
    slugs.push(...page.keys.map(key => key.name.slice(PREFIX.length)))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return slugs
}

export function renderEventPageForRequest(event: H3Event, slug: string, page: EventPage): string {
  const domains = parseShortDomains(useRuntimeConfig(event).public.shortDomains)
  // Uploads and theme files live on Sink's own host (the primary short
  // domain). Requests arriving through the rewrite Worker keep the visitor's
  // Host header, so the request origin may be a subdomain that would turn
  // /_assets/... into a slug.
  const primary = domains.find(d => !d.prefix)
  const assetOrigin = primary ? `https://${primary.domain}` : getRequestURL(event).origin
  const shortUrl = (s: string) => slugToShortUrl(s, domains, assetOrigin)
  return renderEventPageHtml(page, { slug, pageUrl: shortUrl(slug), assetOrigin, shortUrl })
}
