// undefined-charity fork: renders an EventPage to a standalone HTML document.
// Shared by the redirect middleware (the public page) and the dashboard editor
// (live preview in an iframe), so both always match.
//
// Markdown conventions, kept deliberately small:
// - a paragraph that is only a link becomes a button
// - a blockquote becomes a highlighted box (e.g. the donate box)
// - targets starting with "/" are the event's own links: on slug `frost`,
//   "/rsvp" is the link `frost-rsvp` (https://frost.puppy.events/rsvp)
// - "/_assets/..." images (uploads) and "/event/..." theme files are served
//   from the Sink host
// Raw HTML in the Markdown is shown as text, and only http(s), mailto and tel
// URLs are kept, so a page cannot inject scripts.

import type { Tokens } from 'marked'
import type { EventPage } from '../schemas/event-page'
import type { EventPageRenderOptions } from './event-page-links'
import { Marked } from 'marked'
import { googleFontsHref } from './event-page-fonts'
import { escapeHtml, resolveEventHref } from './event-page-links'
import { sanitizeEventHtml } from './event-page-sanitize'

export type { EventPageRenderOptions } from './event-page-links'
export { escapeHtml, resolveEventHref } from './event-page-links'

export function renderEventMarkdown(markdown: string, options: EventPageRenderOptions): string {
  const marked = new Marked({
    gfm: true,
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return escapeHtml(text)
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens)
        const url = resolveEventHref(href, options)
        if (!url)
          return text
        const external = /^https?:/i.test(url) && !url.startsWith(options.assetOrigin)
        return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' rel="noopener"' : ''}>${text}</a>`
      },
      image({ href, title, text }: Tokens.Image) {
        const url = resolveEventHref(href, options)
        if (!url)
          return escapeHtml(text)
        const caption = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : ''
        return `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(text)}" loading="lazy">${caption}</figure>`
      },
      paragraph({ tokens }: Tokens.Paragraph) {
        const meaningful = tokens.filter(token => !(token.type === 'text' && !token.raw.trim()))
        if (meaningful.length === 1 && meaningful[0]!.type === 'link') {
          const link = meaningful[0] as Tokens.Link
          const url = resolveEventHref(link.href, options)
          if (url)
            return `<p class="cta"><a class="button" href="${escapeHtml(url)}">${this.parser.parseInline(link.tokens)}</a></p>\n`
        }
        if (meaningful.length === 1 && meaningful[0]!.type === 'image')
          return `${this.parser.parseInline(tokens)}\n`
        return `<p>${this.parser.parseInline(tokens)}</p>\n`
      },
      blockquote({ tokens }: Tokens.Blockquote) {
        return `<aside class="callout">${this.parser.parse(tokens)}</aside>\n`
      },
    },
  })
  return marked.parse(markdown, { async: false }) as string
}

function plainSummary(page: EventPage): string {
  const parts = [page.when, page.where].filter(Boolean).join(' · ')
  const firstLine = page.body.split('\n').map(line => line.replace(/^[#>\-*\s]+/, '').trim()).find(line => line && !line.startsWith('['))
  return [parts, page.host || firstLine].filter(Boolean).join(' — ').slice(0, 300)
}

/** The page body as HTML: rich-editor HTML (sanitised) or legacy Markdown. */
export function renderEventBody(page: EventPage, options: EventPageRenderOptions): string {
  return page.format === 'html' ? sanitizeEventHtml(page.body, options) : renderEventMarkdown(page.body, options)
}

export function renderEventPageHtml(page: EventPage, options: EventPageRenderOptions): string {
  const e = escapeHtml
  const body = renderEventBody(page, options)
  const hero = page.hero ? resolveEventHref(page.hero, options) : undefined
  const whereUrl = page.whereUrl ? resolveEventHref(page.whereUrl, options) : undefined
  const summary = plainSummary(page)
  const where = page.where
    ? (whereUrl ? `<a href="${e(whereUrl)}" rel="noopener">${e(page.where)}</a>` : e(page.where))
    : ''
  const meta = [page.host ? e(page.host) : '', where ? `📍 ${where}` : ''].filter(Boolean).join('<br>')
  const logo = `${options.assetOrigin}/event/undefined-logo.svg`
  const year = new Date().getUTCFullYear()

  return `<!doctype html>
<html lang="en" data-bg="${e(page.background)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(page.title)}</title>
<meta name="description" content="${e(summary)}">
<link rel="canonical" href="${e(options.pageUrl)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${e(page.title)}">
<meta property="og:description" content="${e(summary)}">
<meta property="og:url" content="${e(options.pageUrl)}">
${hero ? `<meta property="og:image" content="${e(hero)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="theme-color" content="${e(page.accent)}">
<link rel="icon" href="${e(logo)}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${e(googleFontsHref(body))}" rel="stylesheet">
<style>
:root{--accent:${e(page.accent)};--bg:#fff;--card:rgba(244,244,245,.86);--text:#222;--muted:#555;--heading:#111;--line:rgba(0,0,0,.08)}
html[data-bg="dark"]{--bg:#111114;--card:rgba(30,30,36,.92);--text:#e7e7ea;--muted:#a1a1aa;--heading:#fafafa;--line:rgba(255,255,255,.1)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.65 "Open Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
html[data-bg="undefined"] body::before{content:"";position:absolute;inset:0 0 auto 0;height:760px;background:linear-gradient(180deg,#e3a3ee 0%,#f3b3dc 38%,#fcd9e6 70%,#fff 100%);z-index:-1}
html[data-bg="light"] body::before{content:"";position:absolute;inset:0 0 auto 0;height:420px;background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 35%,#fff),#fff);z-index:-1}
html[data-bg="dark"] body::before{content:"";position:absolute;inset:0 0 auto 0;height:420px;background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 45%,#111114),#111114);z-index:-1}
a{color:inherit}
.bar{max-width:1160px;margin:16px auto 0;padding:14px 22px;border-radius:12px;background:rgba(255,255,255,.35);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 1px 3px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:space-between;font-weight:600}
html[data-bg="dark"] .bar{background:rgba(0,0,0,.3)}
.bar a{text-decoration:none}
main{max-width:768px;margin:48px auto 64px;padding:0 16px}
.card{background:var(--card);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.15);padding:32px}
.when{margin:0 0 4px;color:color-mix(in srgb,var(--accent) 75%,#fff);font-size:14px;text-transform:uppercase;letter-spacing:.02em}
h1,h2,h3{font-family:"Times New Roman",Times,serif;color:var(--heading);line-height:1.2}
h1{margin:0 0 6px;font-size:clamp(28px,5vw,34px)}
h2{margin:36px 0 12px;font-size:25px;font-weight:400}
h3{margin:20px 0 8px;font-size:20px;font-weight:400}
.meta{margin:0 0 8px;color:var(--muted)}
.hero{display:block;width:100%;border-radius:8px;margin:20px 0 4px}
.body ul,.body ol{padding-left:24px}
.body li{margin:8px 0}
figure{margin:20px 0}
figure img{display:block;max-width:100%;height:auto;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.15)}
figcaption{margin-top:6px;font-size:14px;color:var(--muted)}
.cta{margin:18px 0}
.body img{max-width:100%;height:auto;border-radius:8px}
.body p:empty{min-height:1em}
.body mark{padding:0 .15em;border-radius:3px}
.body a.button{margin:6px 0}
.button{display:inline-block;line-height:1.4;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;padding:9px 16px;border-radius:6px;box-shadow:0 1px 2px rgba(0,0,0,.15)}
.button:hover{filter:brightness(1.08)}
.callout{margin:28px 0;padding:4px 24px;border:1px solid color-mix(in srgb,var(--accent) 45%,transparent);background:color-mix(in srgb,var(--accent) 16%,transparent);border-radius:10px}
.callout h2,.callout h3{margin-top:18px}
hr{border:0;border-top:1px solid var(--line);margin:28px 0}
footer{max-width:1160px;margin:0 auto 24px;padding:16px 22px;border-radius:12px;background:rgba(221,221,221,.3);font-size:14px;color:var(--muted);display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px}
footer img{width:36px;height:36px}
footer .org{display:flex;align-items:center;gap:12px;color:var(--text)}
footer nav{display:flex;gap:16px;margin-left:auto}
footer nav a{text-decoration:none;opacity:.8}
footer nav a:hover{opacity:1;text-decoration:underline}
@media (max-width:600px){.card{padding:22px}main{margin-top:28px}}
</style>
</head>
<body>
<header class="bar"><a href="https://undefined.charity">Undefined</a><a href="https://undefined.charity/events">Events</a></header>
<main>
<article class="card">
${page.when ? `<p class="when">${e(page.when)}</p>` : ''}
<h1>${e(page.title)}</h1>
${meta ? `<p class="meta">${meta}</p>` : ''}
${hero ? `<img class="hero" src="${e(hero)}" alt="">` : ''}
<div class="body">
${body}
</div>
</article>
</main>
<footer>
<a class="org" href="https://undefined.charity" style="text-decoration:none"><img src="${e(logo)}" alt="Undefined"><span>© Undefined ${year} · 501(c)(3) Nonprofit · EIN 33-3432965</span></a>
<nav><a href="https://undefined.charity/terms/">Terms &amp; Conditions</a><a href="https://undefined.charity/privacy/">Privacy Policy</a></nav>
</footer>
</body>
</html>`
}
