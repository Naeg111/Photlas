import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Issue#130: テスト環境では React.lazy + Suspense と Testing Library の waitFor の相性が悪く、
 * 動的 import の Promise resolve タイミングで描画を拾えない問題があるため、
 * 本番では React.lazy で動的読み込み、テストでは静的コンポーネントを返すヘルパー。
 *
 * 本番ビルド時は `import.meta.env.MODE === 'test'` が `false` リテラルに置換され、
 * `staticFallback` 参照は dead code として tree-shake される（Rollup の挙動依存）。
 */
export function lazyOrStatic<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  staticFallback: T
): T | LazyExoticComponent<T> {
  return import.meta.env.MODE === 'test' ? staticFallback : lazy(factory)
}
