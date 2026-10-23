import { describe, expect, it } from 'vitest'
import { defaultEventPage, EventPageSchema } from '../../shared/schemas/event-page'
import { renderEventMarkdown, renderEventPageHtml, resolveEventHref } from '../../shared/utils/event-page-render'
import { parseShortDomains, slugToShortUrl } from '../../shared/utils/short-domains'

const domains = parseShortDomains({ 'puppy.events': {}, 'seattlenaked.men': { prefix: 'snm' } })
const origin = 'https://puppy.events'
function options(slug = 'frost') {
  return {
    slug,
    pageUrl: slugToShortUrl(slug, domains, origin),
    assetOrigin: origin,
    shortUrl: (s: string) => slugToShortUrl(s, domains, origin),
  }
}

describe('resolveEventHref', () => {
  it('maps event-relative paths onto the event\'s own links', () => {
    expect(resolveEventHref('/rsvp', options())).toBe('https://frost.puppy.events/rsvp')
    expect(resolveEventHref('/donate', options('snm-cagecheck'))).toBe('https://cagecheck.seattlenaked.men/donate')
    expect(resolveEventHref('/', options())).toBe('https://frost.puppy.events')
  })

  it('serves uploads from the Sink host and drops unsafe schemes', () => {
    expect(resolveEventHref('/_assets/images/frost/a.png', options())).toBe('https://puppy.events/_assets/images/frost/a.png')
    expect(resolveEventHref('https://partiful.com/e/x', options())).toBe('https://partiful.com/e/x')
    expect(resolveEventHref('mailto:a@b.c', options())).toBe('mailto:a@b.c')
    expect(resolveEventHref('javascript:alert(1)', options())).toBeUndefined()
    expect(resolveEventHref('//evil.example', options())).toBeUndefined()
  })
})

describe('renderEventMarkdown', () => {
  it('turns a lone link into a button and quotes into a callout', () => {
    const html = renderEventMarkdown('Grab your spot:\n\n[RSVP](/rsvp)\n\n> ### Support\n> Help out.\n>\n> [Donate](/donate)', options())
    expect(html).toContain('<p class="cta"><a class="button" href="https://frost.puppy.events/rsvp">RSVP</a></p>')
    expect(html).toContain('<aside class="callout">')
    expect(html).toContain('href="https://frost.puppy.events/donate"')
  })

  it('keeps inline links inline and renders captioned images', () => {
    const html = renderEventMarkdown('Park at [the lot](https://maps.example/x) behind.\n\n![Parking map](/_assets/images/frost/p.png "Use the back lot")', options())
    expect(html).toContain('<p>Park at <a href="https://maps.example/x"')
    expect(html).toContain('<figure><img src="https://puppy.events/_assets/images/frost/p.png" alt="Parking map" loading="lazy"><figcaption>Use the back lot</figcaption></figure>')
  })

  it('shows raw HTML as text and strips unsafe links', () => {
    const html = renderEventMarkdown('<script>alert(1)</script>\n\n[click](javascript:alert(1)) <img src=x onerror=alert(1)>', options())
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('javascript:')
  })
})

describe('renderEventPageHtml', () => {
  it('renders a full page with escaped fields, footer and OG tags', () => {
    const page = EventPageSchema.parse({ ...defaultEventPage('Frost "After" <Dark>'), when: 'Sat', where: 'Kink Center', hero: '/_assets/images/frost/h.png' })
    const html = renderEventPageHtml(page, options())
    expect(html).toContain('<title>Frost &quot;After&quot; &lt;Dark&gt;</title>')
    expect(html).toContain('<meta property="og:image" content="https://puppy.events/_assets/images/frost/h.png">')
    expect(html).toContain('https://undefined.charity/terms/')
    expect(html).toContain('https://undefined.charity/privacy/')
    expect(html).toContain('/event/undefined-logo.svg')
    expect(html).toContain('href="https://frost.puppy.events/rsvp"')
  })

  it('rejects bad accents and requires a title', () => {
    expect(EventPageSchema.safeParse({ title: '' }).success).toBe(false)
    expect(EventPageSchema.safeParse({ title: 'x', accent: 'red' }).success).toBe(false)
  })
})
