import { SaveEventPageSchema } from '#shared/schemas/event-page'

defineRouteMeta({
  openAPI: {
    description: 'Create or replace the event page for an existing link (undefined-charity fork)',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  assertLinkWritesAllowed(event, 'edit')
  const { slug: rawSlug, page } = await readValidatedBody(event, SaveEventPageSchema.parse)
  const slug = normalizeSlug(event, rawSlug)
  if (!await getLink(event, slug))
    throw createError({ status: 404, statusText: 'Link not found' })
  await putEventPage(event, slug, page)
  return { page }
})
