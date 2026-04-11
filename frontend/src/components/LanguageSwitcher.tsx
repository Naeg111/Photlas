import { useRef, useState, useCallback, useEffect } from 'react'
import { type SupportedLanguage, SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../i18n'

interface LanguageSwitcherProps {
  currentLanguage: SupportedLanguage
  onLanguageChange: (language: SupportedLanguage) => void
}

const SWITCH_SIZE = 28
const GAP = 4

export function LanguageSwitcher({ currentLanguage, onLanguageChange }: Readonly<LanguageSwitcherProps>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const dragStartRef = useRef<{ startX: number; startOffset: number } | null>(null)

  const currentIndex = SUPPORTED_LANGUAGES.indexOf(currentLanguage)
  const itemWidth = SWITCH_SIZE + GAP
  const totalWidth = itemWidth * SUPPORTED_LANGUAGES.length + GAP

  const getOffset = useCallback((index: number) => {
    return GAP + index * itemWidth
  }, [itemWidth])

  const switchOffset = dragX !== null ? dragX : getOffset(currentIndex)

  const getNearestLanguage = useCallback((x: number): SupportedLanguage => {
    const index = Math.round((x - GAP) / itemWidth)
    const clamped = Math.max(0, Math.min(SUPPORTED_LANGUAGES.length - 1, index))
    return SUPPORTED_LANGUAGES[clamped]
  }, [itemWidth])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const currentOffset = getOffset(currentIndex)
    // Check if clicking on the switch thumb
    if (Math.abs(x - currentOffset - SWITCH_SIZE / 2) < SWITCH_SIZE) {
      setIsDragging(true)
      dragStartRef.current = { startX: e.clientX, startOffset: currentOffset }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    }
  }, [currentIndex, getOffset])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return
    const delta = e.clientX - dragStartRef.current.startX
    const newX = dragStartRef.current.startOffset + delta
    const clamped = Math.max(getOffset(0), Math.min(getOffset(SUPPORTED_LANGUAGES.length - 1), newX))
    setDragX(clamped)
  }, [isDragging, getOffset])

  const handlePointerUp = useCallback(() => {
    if (isDragging && dragX !== null) {
      const lang = getNearestLanguage(dragX)
      if (lang !== currentLanguage) {
        onLanguageChange(lang)
      }
    }
    setIsDragging(false)
    setDragX(null)
    dragStartRef.current = null
  }, [isDragging, dragX, getNearestLanguage, currentLanguage, onLanguageChange])

  const handleLabelClick = useCallback((lang: SupportedLanguage) => {
    if (!isDragging && lang !== currentLanguage) {
      onLanguageChange(lang)
    }
  }, [isDragging, currentLanguage, onLanguageChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsDragging(false)
      setDragX(null)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative flex items-center rounded-full select-none touch-none"
      style={{
        width: totalWidth,
        height: SWITCH_SIZE + GAP * 2,
        backgroundColor: '#000',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Switch thumb with slide animation */}
      <div
        className="absolute rounded-full bg-white z-10 pointer-events-none"
        style={{
          width: SWITCH_SIZE,
          height: SWITCH_SIZE,
          left: switchOffset,
          top: GAP,
          transition: isDragging ? 'none' : 'left 0.2s ease-out',
        }}
      />
      {/* Language labels */}
      {SUPPORTED_LANGUAGES.map((lang, index) => {
        const isSelected = lang === currentLanguage && dragX === null
        return (
          <button
            key={lang}
            type="button"
            data-selected={isSelected}
            className="relative z-20 flex items-center justify-center cursor-pointer"
            style={{
              width: SWITCH_SIZE,
              height: SWITCH_SIZE,
              marginLeft: index === 0 ? GAP : GAP / 2,
              marginRight: index === SUPPORTED_LANGUAGES.length - 1 ? GAP : GAP / 2,
              fontSize: 11,
              fontWeight: 600,
              color: isSelected ? '#000' : '#fff',
              transition: 'color 0.2s ease-out',
            }}
            onClick={() => handleLabelClick(lang)}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        )
      })}
    </div>
  )
}
