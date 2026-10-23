// undefined-charity fork: fonts the event page editor offers. Google fonts are
// loaded on a published page only when its content uses them.
export interface EventFont {
  label: string
  /** CSS font-family value written into the content. */
  family: string
  /** Google Fonts family spec, when it has to be loaded. */
  google?: string
}

export const EVENT_FONTS: EventFont[] = [
  { label: 'Open Sans', family: '"Open Sans", sans-serif' },
  { label: 'Serif', family: '"Times New Roman", Times, serif' },
  { label: 'Georgia', family: 'Georgia, serif' },
  { label: 'Playfair Display', family: '"Playfair Display", serif', google: 'Playfair+Display:ital,wght@0,400;0,700;1,400' },
  { label: 'Montserrat', family: 'Montserrat, sans-serif', google: 'Montserrat:ital,wght@0,400;0,700;1,400' },
  { label: 'Bebas Neue', family: '"Bebas Neue", sans-serif', google: 'Bebas+Neue' },
  { label: 'Pacifico', family: 'Pacifico, cursive', google: 'Pacifico' },
  { label: 'Monospace', family: '"Courier New", monospace' },
]

export const EVENT_FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px', '48px', '64px']

/** Google Fonts stylesheet URL for the fonts a piece of HTML uses (Open Sans always). */
export function googleFontsHref(html: string, all = false): string {
  const families = new Set(['Open+Sans:ital,wght@0,400;0,600;0,700;1,400'])
  for (const font of EVENT_FONTS) {
    if (font.google && (all || html.includes(font.family.split(',')[0]!.replace(/"/g, '')) || html.includes(font.family.split(',')[0]!.replace(/"/g, '&quot;'))))
      families.add(font.google)
  }
  return `https://fonts.googleapis.com/css2?${[...families].map(f => `family=${f}`).join('&')}&display=swap`
}
