import { Component, type ReactNode, type ErrorInfo } from 'react'
import * as Sentry from '@sentry/react'
import { Button } from './ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * グローバルエラーバウンダリ
 * 予期しないReactエラー時にフォールバックUIを表示し、Sentryにエラーを報告する
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
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              エラーが発生しました
            </h1>
            <p className="mb-6 text-gray-600">
              予期しないエラーが発生しました。ページを再読み込みしてください。
            </p>
            <Button onClick={this.handleReload}>
              ページを再読み込み
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
