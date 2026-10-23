defineRouteMeta({
  openAPI: {
    description: 'Slugs of links that serve an event page (undefined-charity fork)',
    security: [{ bearerAuth: [] }],
  },
})

export default eventHandler(async event => ({ slugs: await listEventPageSlugs(event) }))
