import type { ShortDomain } from '#shared/utils/short-domains'
import type { DashboardLinkListResponse } from '@/types/dashboard-links'
import { parseShortDomains, slugToShortUrl, withoutScheme } from '#shared/utils/short-domains'

// undefined-charity fork: public URLs for slugs across the configured short domains.
export function useShortDomains() {
  const domains: ShortDomain[] = parseShortDomains(useRuntimeConfig().public.shortDomains)
  const { origin } = useRequestURL()

  const shortUrl = (slug: string) => slugToShortUrl(slug, domains, origin)
  const shortUrlLabel = (slug: string) => withoutScheme(shortUrl(slug))

  return { domains, multiDomain: domains.length > 0, shortUrl, shortUrlLabel }
}

/**
 * Labels for slugs found in analytics, which keep the history of deleted
 * links. A slug with no link any more shows as "<slug> (deleted)" rather than
 * a public URL that does not exist. Existing slugs load once per session.
 */
export function useLinkLabels() {
  const { shortUrlLabel } = useShortDomains()
  const existing = useState<string[] | null>('existing-link-slugs', () => null)
  const loading = useState('existing-link-slugs-loading', () => false)

  async function load() {
    if (existing.value || loading.value)
      return
    loading.value = true
    try {
      const slugs: string[] = []
      let cursor: string | undefined
      do {
        const page: DashboardLinkListResponse = await useAPI<DashboardLinkListResponse>('/api/link/list', {
          query: { status: 'all', limit: 1000, cursor },
        })
        slugs.push(...page.links.map(link => link.slug.toLowerCase()))
        cursor = page.list_complete ? undefined : page.cursor
      } while (cursor)
      existing.value = slugs
    }
    catch (error) {
      console.error(error)
    }
    finally {
      loading.value = false
    }
  }

  if (import.meta.client) {
    void load()
    // A link created or deleted in this session changes the answer.
    useDashboardLinksStore().onLinkUpdate(() => {
      existing.value = null
      void load()
    })
  }

  const existingSet = computed(() => existing.value ? new Set(existing.value) : null)
  const isDeleted = (slug: string) => !!existingSet.value && !existingSet.value.has(slug.toLowerCase())
  const linkLabel = (slug: string) => isDeleted(slug) ? `${slug} (deleted)` : shortUrlLabel(slug)

  return { isDeleted, linkLabel }
}
