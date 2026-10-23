import { LinkSlugQuerySchema } from '#shared/schemas/link'

defineRouteMeta({
  openAPI: {
    description: 'Remove the event page from a link; the link redirects again (undefined-charity fork)',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  assertLinkWritesAllowed(event, 'edit')
  const { slug } = await getValidatedQuery(event, LinkSlugQuerySchema.parse)
  await deleteEventPage(event, normalizeSlug(event, slug))
  setResponseStatus(event, 204)
  return null
})
