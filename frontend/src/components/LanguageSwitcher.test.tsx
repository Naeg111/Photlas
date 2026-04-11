import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LanguageSwitcher } from './LanguageSwitcher'

describe('LanguageSwitcher', () => {
  const defaultProps = {
    currentLanguage: 'ja' as const,
    onLanguageChange: vi.fn(),
  }

  it('should render all 5 language labels', () => {
    render(<LanguageSwitcher {...defaultProps} />)

    expect(screen.getByText('日')).toBeInTheDocument()
    expect(screen.getByText('EN')).toBeInTheDocument()
    expect(screen.getByText('한')).toBeInTheDocument()
    expect(screen.getByText('简')).toBeInTheDocument()
    expect(screen.getByText('繁')).toBeInTheDocument()
  })

  it('should call onLanguageChange when a language is clicked', () => {
    const onLanguageChange = vi.fn()
    render(<LanguageSwitcher {...defaultProps} onLanguageChange={onLanguageChange} />)

    fireEvent.click(screen.getByText('EN'))
    expect(onLanguageChange).toHaveBeenCalledWith('en')
  })

  it('should indicate the currently selected language', () => {
    render(<LanguageSwitcher {...defaultProps} currentLanguage="en" />)

    const enLabel = screen.getByText('EN')
    // The selected language should have the switcher indicator (white circle)
    expect(enLabel.closest('[data-selected="true"]')).toBeInTheDocument()
  })

  it('should call onLanguageChange with correct language code for each label', () => {
    const onLanguageChange = vi.fn()
    render(<LanguageSwitcher {...defaultProps} onLanguageChange={onLanguageChange} />)

    fireEvent.click(screen.getByText('EN'))
    expect(onLanguageChange).toHaveBeenCalledWith('en')

    fireEvent.click(screen.getByText('한'))
    expect(onLanguageChange).toHaveBeenCalledWith('ko')

    fireEvent.click(screen.getByText('简'))
    expect(onLanguageChange).toHaveBeenCalledWith('zh-CN')

    fireEvent.click(screen.getByText('繁'))
    expect(onLanguageChange).toHaveBeenCalledWith('zh-TW')
  })

  it('should not call onLanguageChange when clicking already selected language', () => {
    const onLanguageChange = vi.fn()
    render(<LanguageSwitcher {...defaultProps} currentLanguage="ja" onLanguageChange={onLanguageChange} />)

    fireEvent.click(screen.getByText('日'))
    expect(onLanguageChange).not.toHaveBeenCalled()
  })
})
