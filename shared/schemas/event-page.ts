import { z } from 'zod'

// undefined-charity fork: a one-page event site served at a link's own URL
// instead of redirecting. Stored in KV next to the link (event-page:<slug>).

export const EVENT_PAGE_BACKGROUNDS = ['undefined', 'light', 'dark'] as const

export const EventPageSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  when: z.string().trim().max(200).default(''),
  where: z.string().trim().max(200).default(''),
  whereUrl: z.union([z.literal(''), z.string().trim().url().max(2048)]).default(''),
  host: z.string().trim().max(300).default(''),
  // 'html' from the rich editor (sanitised on render); 'markdown' for pages saved before it.
  format: z.enum(['markdown', 'html']).default('markdown'),
  body: z.string().max(200_000).default(''),
  hero: z.string().trim().max(2048).default(''),
  accent: z.string().trim().regex(/^#[0-9a-f]{6}$/i, 'Accent must be a #rrggbb color').default('#ea580c'),
  background: z.enum(EVENT_PAGE_BACKGROUNDS).default('undefined'),
})

export type EventPage = z.infer<typeof EventPageSchema>

export const SaveEventPageSchema = z.object({
  slug: z.string().trim().min(1).max(2048),
  page: EventPageSchema,
})

export function defaultEventPage(title = ''): EventPage {
  return {
    title,
    when: '',
    where: '',
    whereUrl: '',
    host: 'Brought to you by Undefined.',
    format: 'html',
    body: [
      '<h2>What to Expect</h2>',
      '<ul><li><p>Something for everyone.</p></li><li><p>Consent is sexy — and being impaired means you can\'t consent.</p></li></ul>',
      '<h2>Getting In</h2>',
      '<p>Add parking or entry directions here. Use the image button to add a map or photo.</p>',
      '<h2>RSVP</h2>',
      '<p>Grab your spot:</p>',
      '<p><a class="button" href="/rsvp">RSVP</a></p>',
      '<aside class="callout"><h3>Support the event</h3><p>Undefined is a nonprofit and relies on your donations to run events like these. To keep more events coming, please consider donating <strong>$10</strong>.</p><p><a class="button" href="/donate">Donate</a></p></aside>',
    ].join(''),
    hero: '',
    accent: '#ea580c',
    background: 'undefined',
  }
}
