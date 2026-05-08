import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  PLATFORM_INSTAGRAM,
  PLATFORM_THREADS,
  PLATFORM_TWITTER,
} from '../utils/codeConstants'
import instagramLogo from '../assets/instagram-logo.svg'
import threadsLogo from '../assets/threads-logo.svg'
import xLogo from '../assets/x-logo.svg'

/**
 * Issue#102: SNSリンク編集ダイアログ
 *
 * 固定3行UI（Instagram → Threads → X）。
 * 各行にブランドガイドライン準拠の黒単色SVGロゴを配置。
 * 入力欄は任意入力で、URLバリデーションは onBlur で実施し、
 * エラーがある状態では保存ボタンを無効化する。
 */

type ServiceKey = 'instagram' | 'threads' | 'x'

interface ServiceConfig {
  key: ServiceKey
  platform: number
  logoSrc: string
  logoAlt: string
  placeholder: string
  errorMessageKey: string
  validateHost: (host: string) => boolean
}

const SERVICES: readonly ServiceConfig[] = [
  {
    key: 'instagram',
    platform: PLATFORM_INSTAGRAM,
    logoSrc: instagramLogo,
    logoAlt: 'Instagram',
    placeholder: 'https://www.instagram.com/username',
    errorMessageKey: 'snsEdit.invalidInstagramUrl',
    validateHost: (host) => host === 'instagram.com' || host.endsWith('.instagram.com'),
  },
  {
    key: 'threads',
    platform: PLATFORM_THREADS,
    logoSrc: threadsLogo,
    logoAlt: 'Threads',
    placeholder: 'https://www.threads.com/@username',
    errorMessageKey: 'snsEdit.invalidThreadsUrl',
    validateHost: (host) =>
      host === 'threads.com' ||
      host.endsWith('.threads.com') ||
      host === 'threads.net' ||
      host.endsWith('.threads.net'),
  },
  {
    key: 'x',
    platform: PLATFORM_TWITTER,
    logoSrc: xLogo,
    logoAlt: 'X',
    placeholder: 'https://x.com/username',
    errorMessageKey: 'snsEdit.invalidXUrl',
    validateHost: (host) =>
      host === 'x.com' ||
      host.endsWith('.x.com') ||
      host === 'twitter.com' ||
      host.endsWith('.twitter.com'),
  },
] as const

interface SnsLinkEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLinks: Array<{ platform?: number; url: string }>
  onSave: (links: Array<{ platform: number; url: string }>) => void
}

type ValueMap = Record<ServiceKey, string>
type ErrorMap = Partial<Record<ServiceKey, string>>

function buildInitialValues(initialLinks: Array<{ platform?: number; url: string }>): ValueMap {
  const values: ValueMap = { instagram: '', threads: '', x: '' }
  for (const link of initialLinks) {
    const service = SERVICES.find(s => s.platform === link.platform)
    if (service) {
      values[service.key] = link.url
    }
  }
  return values
}

/**
 * URL のホスト名を抽出する。https/http 以外のスキームや解析不可なら null。
 */
function extractHost(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.host.toLowerCase()
  } catch {
    return null
  }
}

export function SnsLinkEditDialog({
  open,
  onOpenChange,
  initialLinks,
  onSave,
}: Readonly<SnsLinkEditDialogProps>) {
  const { t } = useTranslation()
  const [values, setValues] = useState<ValueMap>(() => buildInitialValues(initialLinks))
  const [errors, setErrors] = useState<ErrorMap>({})

  useEffect(() => {
    if (open) {
      setValues(buildInitialValues(initialLinks))
      setErrors({})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (key: ServiceKey, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }))
    // 入力中はエラーをクリアして再入力時のUXを良くする
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleBlur = (service: ServiceConfig) => {
    const value = values[service.key].trim()
    // 空欄は任意入力なのでバリデーションしない
    if (value === '') {
      setErrors(prev => {
        const next = { ...prev }
        delete next[service.key]
        return next
      })
      return
    }
    const host = extractHost(value)
    if (host === null) {
      setErrors(prev => ({ ...prev, [service.key]: t('snsEdit.invalidUrlFormat') }))
      return
    }
    if (!service.validateHost(host)) {
      setErrors(prev => ({ ...prev, [service.key]: t(service.errorMessageKey) }))
      return
    }
    setErrors(prev => {
      const next = { ...prev }
      delete next[service.key]
      return next
    })
  }

  const hasError = Object.values(errors).some(e => !!e)

  const handleSave = () => {
    const links = SERVICES
      .map(s => ({ platform: s.platform, url: values[s.key].trim() }))
      .filter(l => l.url !== '')
    onSave(links)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="sns-link-edit-dialog"
        className="max-h-[90vh]"
        style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>{t('snsEdit.title')}</DialogTitle>
            <DialogDescription className="sr-only">{t('snsEdit.description')}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <div className="space-y-4 mt-4">
            {SERVICES.map(service => (
              <div key={service.key} className="flex flex-col gap-1">
                <div className="flex gap-3 items-center">
                  <img
                    src={service.logoSrc}
                    alt={service.logoAlt}
                    data-testid={`sns-logo-${service.key}`}
                    loading="eager"
                    className="w-8 h-8 opacity-60 hover:opacity-100 transition-opacity shrink-0"
                  />
                  <Input
                    data-testid={`sns-url-input-${service.key}`}
                    placeholder={service.placeholder}
                    className="flex-1"
                    value={values[service.key]}
                    onChange={(e) => handleChange(service.key, e.target.value)}
                    onBlur={() => handleBlur(service)}
                    aria-invalid={!!errors[service.key]}
                  />
                </div>
                {errors[service.key] && (
                  <p
                    data-testid={`sns-url-error-${service.key}`}
                    className="text-sm text-red-500 ml-11"
                  >
                    {errors[service.key]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={hasError}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
