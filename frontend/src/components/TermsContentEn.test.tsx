import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TermsContentEn } from './TermsContentEn'

/**
 * Basic structure tests - newly added in Issue#105 to compensate for the
 * missing test coverage of the English Terms content.
 */
describe('TermsContentEn - Basic structure', () => {
  it('contains Article 1 (Application) heading', () => {
    const { container } = render(<TermsContentEn />)
    expect(container.textContent).toContain('Article 1')
  })

  it('contains Article 3 (User Registration) heading', () => {
    const { container } = render(<TermsContentEn />)
    expect(container.textContent).toContain('Article 3')
  })

  it('contains Article 5 (Prohibited Acts) heading', () => {
    const { container } = render(<TermsContentEn />)
    expect(container.textContent).toContain('Article 5')
  })

  it('contains Article 16 (Governing Law / Jurisdiction) heading', () => {
    const { container } = render(<TermsContentEn />)
    expect(container.textContent).toContain('Article 16')
  })

  it('shows the enacted date', () => {
    const { container } = render(<TermsContentEn />)
    expect(container.textContent).toContain('Enacted')
  })
})

/**
 * Issue#105: International upgrade.
 * Add: filming-location law compliance, international usage notice,
 * and minimum age requirement.
 */
describe('TermsContentEn - Issue#105 International upgrade', () => {
  // F. Article 5 - Filming-location law compliance
  it('Article 5 covers poster responsibility for laws of the filming location', () => {
    const { container } = render(<TermsContentEn />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/laws of the (?:filming|shooting|photographing|jurisdiction|country)/i)
    expect(text).toMatch(/consent|de-identif/i)
  })

  // G. Article 16 - International usage notice
  it('Article 16 contains the international usage notice (user verifies their own jurisdiction)', () => {
    const { container } = render(<TermsContentEn />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/access(?:ed|ible) (?:from )?worldwide|worldwide access/i)
    expect(text).toMatch(/(?:your|the user's) (?:home )?(?:country|jurisdiction).*law/i)
  })

  // H. Article 3 - Minimum age 13
  it('Article 3 states the 13 years of age requirement', () => {
    const { container } = render(<TermsContentEn />)
    const text = container.textContent ?? ''
    expect(text).toContain('13 years')
  })

  // Last revised note
  it('Last revised note indicates international version update', () => {
    const { container } = render(<TermsContentEn />)
    const text = container.textContent ?? ''
    expect(text).toMatch(/international version|international upgrade/i)
  })
})
