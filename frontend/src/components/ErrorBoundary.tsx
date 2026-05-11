import { Component, type ReactNode, type ErrorInfo } from 'react'
import * as Sentry from '@sentry/react'
import { Translation } from 'react-i18next'
import { Button } from './ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/** Issue#130: 動的 import の chunk ロード失敗時に同一セッションで複数回リロードしないためのフラグ */
const CHUNK_RELOAD_FLAG_KEY = 'photlas:chunk-error-reloaded'

/**
 * Issue#130: 動的 import の chunk ロード失敗を検出する。
 * デプロイ後の旧 index.html → 新 chunk 不整合や、ネットワーク断による chunk fetch 失敗が該当。
 */
export function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk \d+ failed/i.test(error.message) ||
    /Failed to fetch dynamically imported module/i.test(error.message)
  )
}

/**
 * グローバルエラーバウンダリ
 * 予期しないReactエラー時にフォールバックUIを表示し、Sentryにエラーを報告する。
 * Issue#130: 動的 import の chunk ロード失敗時は自動でリロードする。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Issue#130: chunk ロード失敗はデプロイ直後の旧 index.html → 新 chunk 不整合で起きる典型問題。
    // セッション中に 1 回だけ自動リロードして救済する（ループ防止に sessionStorage フラグ）。
    if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_FLAG_KEY)) {
      sessionStorage.setItem(CHUNK_RELOAD_FLAG_KEY, '1')
      globalThis.location.reload()
      return
    }

    Sentry.withScope((scope) => {
      scope.setExtra('componentStack', errorInfo.componentStack)
      Sentry.captureException(error)
    })
  }

  handleReload = (): void => {
    globalThis.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Translation>
          {(t) => (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
              <div className="text-center">
                <h1 className="mb-2 text-2xl font-bold text-gray-900">
                  {t('errors.errorOccurred')}
                </h1>
                <p className="mb-6 text-gray-600">
                  {t('errors.unexpected')}
                </p>
                <Button onClick={this.handleReload}>
                  {t('common.reload')}
                </Button>
              </div>
            </div>
          )}
        </Translation>
      )
    }

    return this.props.children
  }
}
