import type { ShortDomain } from '#shared/utils/short-domains'
import { parseShortDomains, slugToShortUrl, withoutScheme } from '#shared/utils/short-domains'

// undefined-charity fork: public URLs for slugs across the configured short domains.
export function useShortDomains() {
  const domains: ShortDomain[] = parseShortDomains(useRuntimeConfig().public.shortDomains)
  const { origin } = useRequestURL()

  const shortUrl = (slug: string) => slugToShortUrl(slug, domains, origin)
  const shortUrlLabel = (slug: string) => withoutScheme(shortUrl(slug))

  return { domains, multiDomain: domains.length > 0, shortUrl, shortUrlLabel }
}
