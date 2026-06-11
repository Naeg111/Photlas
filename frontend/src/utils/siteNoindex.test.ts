/**
 * Issue#143: staging サイト全体 noindex の build 時注入ヘルパーのテスト。
 */
import { describe, it, expect } from 'vitest'
import { injectSiteNoindex, SITE_NOINDEX_META } from './siteNoindex'

const HTML = '<!doctype html><html><head><title>Photlas</title></head><body></body></html>'

describe('injectSiteNoindex', () => {
  it('enabled=true で </head> 直前に noindex メタを注入する', () => {
    const out = injectSiteNoindex(HTML, true)
    expect(out).toContain(SITE_NOINDEX_META)
    expect(out.indexOf(SITE_NOINDEX_META)).toBeLessThan(out.indexOf('</head>'))
  })

  it('enabled=false なら何も注入しない（HTML 不変）', () => {
    expect(injectSiteNoindex(HTML, false)).toBe(HTML)
  })

  it('二重注入しない（既に注入済みなら追加しない）', () => {
    const once = injectSiteNoindex(HTML, true)
    const twice = injectSiteNoindex(once, true)
    expect((twice.match(/name="robots"/g) || []).length).toBe(1)
  })

  it('content は noindex（follow は付けない＝サイト全体除外）', () => {
    expect(SITE_NOINDEX_META).toContain('content="noindex"')
    expect(SITE_NOINDEX_META).not.toContain('follow')
  })
})
