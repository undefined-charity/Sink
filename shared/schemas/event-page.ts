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
  body: z.string().max(50_000).default(''),
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
    body: `## What to Expect

- Something for everyone.
- Consent is sexy — and being impaired means you can't consent.

## Getting In

Add parking or entry directions here. Use **Insert image** for a map or photo.

## RSVP

Grab your spot:

[RSVP](/rsvp)

> ### Support the event
> This event is pay-what-you-can. Your donation helps cover the venue and supplies.
>
> [Donate — Pay What You Can](/donate)
`,
    hero: '',
    accent: '#ea580c',
    background: 'undefined',
  }
}
