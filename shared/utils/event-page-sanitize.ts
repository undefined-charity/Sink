// undefined-charity fork: allow-list sanitiser for event page HTML written in
// the dashboard's rich editor. Runs when the page is rendered (server and
// preview), so stored HTML is never trusted as-is.
import type { EventPageRenderOptions } from './event-page-links'
import xssModule from 'xss'
import { resolveEventHref } from './event-page-links'

const TEXT_STYLE = ['style']
// xss is CommonJS: the Workers runtime only exposes its default export, whose
// typings describe just the filter function, so re-type it as the module.
const xss = xssModule as unknown as typeof import('xss')

const ALLOWED_TAGS: Record<string, string[]> = {
  p: TEXT_STYLE,
  h1: TEXT_STYLE,
  h2: TEXT_STYLE,
  h3: TEXT_STYLE,
  h4: TEXT_STYLE,
  span: TEXT_STYLE,
  mark: TEXT_STYLE,
  li: TEXT_STYLE,
  ul: [],
  ol: ['start'],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  del: [],
  code: [],
  pre: [],
  br: [],
  hr: [],
  blockquote: [],
  aside: ['class'],
  figure: [],
  figcaption: [],
  a: ['href', 'title', 'class'],
  img: ['src', 'alt', 'title', 'width', 'height'],
}

const ALLOWED_CSS: Record<string, true> = {
  'color': true,
  'background-color': true,
  'font-family': true,
  'font-size': true,
  'font-weight': true,
  'font-style': true,
  'text-align': true,
  'text-decoration': true,
  'line-height': true,
}

const ALLOWED_CLASSES: Record<string, string[]> = {
  a: ['button'],
  aside: ['callout'],
}

export function sanitizeEventHtml(html: string, options: EventPageRenderOptions): string {
  const filter = new xss.FilterXSS({
    whiteList: ALLOWED_TAGS,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript'],
    allowCommentTag: false,
    css: { whiteList: ALLOWED_CSS },
    onTagAttr(tag, name, value) {
      if ((tag === 'a' && name === 'href') || (tag === 'img' && name === 'src')) {
        const url = resolveEventHref(value, options)
        return url ? `${name}="${xss.escapeAttrValue(url)}"` : ''
      }
      if (name === 'class') {
        const keep = value.split(/\s+/).filter(c => ALLOWED_CLASSES[tag]?.includes(c))
        return keep.length ? `class="${keep.join(' ')}"` : ''
      }
      if (name === 'style' && /url\s*\(|expression|javascript:|@import|\\/i.test(value))
        return ''
      return undefined
    },
  })
  return filter.process(html)
}
