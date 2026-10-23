import { LinkSlugQuerySchema } from '#shared/schemas/link'

defineRouteMeta({
  openAPI: {
    description: 'Get the event page attached to a link (undefined-charity fork)',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async (event) => {
  const { slug } = await getValidatedQuery(event, LinkSlugQuerySchema.parse)
  const page = await getEventPage(event, normalizeSlug(event, slug))
  if (!page)
    throw createError({ status: 404, statusText: 'No event page' })
  return { page }
})
