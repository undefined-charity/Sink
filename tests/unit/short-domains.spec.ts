import { describe, expect, it } from 'vitest'
import { buildSlug, isValidShortSubdomain, parseShortDomains, slugShortDomain, slugToShortUrl, splitSlug } from '../../shared/utils/short-domains'

const domains = parseShortDomains('{"puppy.events":{},"seattlegay.events":{"prefix":"sge"},"seattlenaked.men":{"prefix":"SNM"}}')
const origin = 'https://puppy.events'

describe('parseShortDomains', () => {
  it('normalizes and puts the primary first', () => {
    expect(domains).toEqual([
      { domain: 'puppy.events', prefix: '' },
      { domain: 'seattlegay.events', prefix: 'sge' },
      { domain: 'seattlenaked.men', prefix: 'snm' },
    ])
  })

  it('falls back to single-domain mode on bad config', () => {
    expect(parseShortDomains('')).toEqual([])
    expect(parseShortDomains('not json')).toEqual([])
    expect(parseShortDomains({ 'a.com': {}, 'b.com': {} })).toEqual([])
    expect(parseShortDomains({ 'a.com': {}, 'b.com': { prefix: 'b-x' } })).toEqual([])
  })
})

describe('slugToShortUrl', () => {
  it.each([
    ['frostbiteafters', 'https://frostbiteafters.puppy.events'],
    ['frostbiteafters-rsvp', 'https://frostbiteafters.puppy.events/rsvp'],
    ['a-b-c', 'https://a.puppy.events/b-c'],
    ['sge', 'https://seattlegay.events'],
    ['sge-calendar', 'https://calendar.seattlegay.events'],
    ['snm-cagecheck', 'https://cagecheck.seattlenaked.men'],
    ['SNM-Discord', 'https://discord.seattlenaked.men'],
    ['snmx', 'https://snmx.puppy.events'],
  ])('%s -> %s', (slug, url) => {
    expect(slugToShortUrl(slug, domains, origin)).toBe(url)
  })

  it('keeps upstream URLs without config', () => {
    expect(slugToShortUrl('abc', [], origin)).toBe('https://puppy.events/abc')
  })
})

describe('buildSlug', () => {
  const [puppy, sge, snm] = domains as [typeof domains[0], typeof domains[0], typeof domains[0]]

  it('joins prefix, subdomain and path like the front Worker', () => {
    expect(buildSlug(puppy, 'frostbiteafters', 'rsvp')).toBe('frostbiteafters-rsvp')
    expect(buildSlug(puppy, '', 'frostbiteafters')).toBe('frostbiteafters')
    expect(buildSlug(puppy, '', '')).toBe('')
    expect(buildSlug(sge, '', '')).toBe('sge')
    expect(buildSlug(snm, 'CageCheck', '/a/b/')).toBe('snm-cagecheck-a-b')
  })

  it('round-trips through splitSlug and slugShortDomain', () => {
    const slug = buildSlug(snm, 'cagecheck', 'rsvp-now')
    expect(slugShortDomain(slug, domains)?.domain).toBe('seattlenaked.men')
    expect(splitSlug(slug, domains)).toEqual({ domain: snm, sub: 'cagecheck', path: 'rsvp-now' })
  })

  it('rejects hyphenated subdomains', () => {
    expect(isValidShortSubdomain('')).toBe(true)
    expect(isValidShortSubdomain('frost2')).toBe(true)
    expect(isValidShortSubdomain('frost-bite')).toBe(false)
  })
})
