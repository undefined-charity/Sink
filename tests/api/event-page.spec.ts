import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteStoredLinks, fetch, fetchWithAuth, postJson, putJson, setLinkStoreD1Mode } from '../utils'

// undefined-charity fork: event pages served at a link's own URL.
const createdSlugs = new Set<string>()

beforeEach(async () => {
  await setLinkStoreD1Mode()
})

afterEach(async () => {
  await deleteStoredLinks([...createdSlugs])
  createdSlugs.clear()
})

async function createLink() {
  const slug = `page-${crypto.randomUUID().slice(0, 8)}`
  createdSlugs.add(slug)
  const response = await postJson('/api/link/create', { url: 'https://example.com/fallback', slug })
  expect(response.status).toBe(201)
  return slug
}

const page = { title: 'Frostbite After Dark', when: 'Saturday', body: 'Hello\n\n[RSVP](/rsvp)' }

describe('/api/page', () => {
  it('serves the page instead of redirecting, then redirects again once removed', async () => {
    const slug = await createLink()
    expect((await putJson('/api/page', { slug, page })).status).toBe(200)

    const served = await fetch(`/${slug}`, { redirect: 'manual' })
    expect(served.status).toBe(200)
    expect(served.headers.get('content-type')).toContain('text/html')
    const html = await served.text()
    expect(html).toContain('<h1>Frostbite After Dark</h1>')
    expect(html).toContain(`/${slug}-rsvp"`)

    const listed = await (await fetchWithAuth('/api/page/list')).json() as { slugs: string[] }
    expect(listed.slugs).toContain(slug)

    expect((await fetchWithAuth(`/api/page?slug=${slug}`, { method: 'DELETE' })).status).toBe(204)
    expect((await fetchWithAuth(`/api/page?slug=${slug}`)).status).toBe(404)
  })

  it('rejects pages for missing links, invalid pages and anonymous writes', async () => {
    expect((await putJson('/api/page', { slug: 'no-such-link-xyz', page })).status).toBe(404)
    const slug = await createLink()
    expect((await putJson('/api/page', { slug, page: { title: '' } })).status).toBe(400)
    expect((await putJson('/api/page', { slug, page }, false)).status).toBe(401)
  })

  it('removes the page with its link', async () => {
    const slug = await createLink()
    await putJson('/api/page', { slug, page })
    expect((await postJson('/api/link/delete', { slug })).status).toBeLessThan(300)
    expect(await env.KV.get(`event-page:${slug}`)).toBeNull()
  })
})
