import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PrivacyContentEn } from './PrivacyContentEn'

/**
 * Issue#94 §4: Privacy policy revision to disclose WAF log collection.
 * Replaces the prior "IP address temporarily collected; not stored permanently"
 * wording with explicit WAF-log retention (up to 90 days, auto-deleted after).
 */
describe('PrivacyContentEn - Issue#94 WAF log disclosure', () => {
  it('Article 2 (7) Technical Information mentions "WAF logs"', () => {
    const { container } = render(<PrivacyContentEn />)
    expect(container.textContent).toContain('WAF logs')
  })

  it('enumerates WAF log fields: IP address, request URL, User-Agent, access time', () => {
    const { container } = render(<PrivacyContentEn />)
    const text = container.textContent ?? ''
    expect(text).toContain('IP address')
    expect(text).toContain('request URL')
    expect(text).toContain('User-Agent')
    expect(text).toContain('access time')
  })

  it('states the purpose: rate limiting, detection and investigation of unauthorized access', () => {
    const { container } = render(<PrivacyContentEn />)
    const text = container.textContent ?? ''
    expect(text).toContain('Rate limiting')
    expect(text).toContain('detection and investigation of unauthorized access')
  })

  it('states the retention period: up to 90 days', () => {
    const { container } = render(<PrivacyContentEn />)
    expect(container.textContent).toContain('Up to 90 days')
  })

  it('states auto-deletion after retention period', () => {
    const { container } = render(<PrivacyContentEn />)
    expect(container.textContent).toContain('automatically deleted')
  })

  it('no longer contains the legacy "not stored permanently" phrasing', () => {
    const { container } = render(<PrivacyContentEn />)
    expect(container.textContent).not.toContain('not stored permanently')
  })
})

/**
 * Issue#99: With Google OAuth scope reduced to email only,
 * the privacy policy must remove "name" from the Google data list.
 * The profile scope is no longer requested, so name is not actually obtained.
 */
describe('PrivacyContentEn - Issue#99 Google scope minimization', () => {
  it('Article 2(8) Google data is "email address, Google user ID" only', () => {
    const { container } = render(<PrivacyContentEn />)
    const text = container.textContent ?? ''
    expect(text).toContain('Google: email address, Google user ID')
  })

  it('Article 2(8) Google data does not include "name"', () => {
    const { container } = render(<PrivacyContentEn />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('email address, name')
  })

  it('Article 2(8) LINE data is unchanged (display name is still collected)', () => {
    const { container } = render(<PrivacyContentEn />)
    const text = container.textContent ?? ''
    expect(text).toContain('LINE: email address, display name, LINE user ID')
  })
})
