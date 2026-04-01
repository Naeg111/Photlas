import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { FilterPanel } from './FilterPanel'

/**
 * Issue#63: フィルター機能の見直し
 * TDD Red段階: 新仕様に合わせたテストケース定義
 *
 * 変更点:
 * - ジャンル: 14種類（ポートレート削除、建造物・夜景・野鳥追加、風景→自然風景、食べ物→グルメ）
 * - 通常フィルターにセクションラベルを追加
 * - 投稿の新しさ・写真の向きを通常フィルターに移動
 * - 投稿の新しさ: 5種類（3ヶ月以内追加）
 * - ISO感度: 4種類に拡張
 * - maxAgeYears → maxAgeDays に変更
 * - 横向き→横位置、縦向き→縦位置（正方形は削除）
 */

describe('FilterPanel', () => {
  const mockOnOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Issue#63: ジャンルフィルター', () => {
    it('14種類のジャンルボタンが表示される', { timeout: 30000 }, () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const genres = [
        '自然風景', '街並み', '建造物', '夜景', 'グルメ', '植物', '動物',
        '野鳥', '自動車', 'バイク', '鉄道', '飛行機', '星空', 'その他',
      ]

      genres.forEach(genre => {
        expect(screen.getByRole('button', { name: new RegExp(genre) })).toBeInTheDocument()
      })
    })

    it('ポートレートボタンが表示されない', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const allButtons = screen.getAllByRole('button')
      const portraitButton = allButtons.find(btn => btn.textContent?.includes('ポートレート'))
      expect(portraitButton).toBeUndefined()
    })

    it('風景ボタンが表示されない（自然風景に変更済み）', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      // 「風景」単体のボタンは存在しない（「自然風景」のみ）
      const allButtons = screen.getAllByRole('button')
      const exactLandscapeButton = allButtons.find(btn => btn.textContent?.trim() === '風景')
      expect(exactLandscapeButton).toBeUndefined()
    })

    it('食べ物ボタンが表示されない（グルメに変更済み）', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const allButtons = screen.getAllByRole('button')
      const foodButton = allButtons.find(btn => btn.textContent?.includes('食べ物'))
      expect(foodButton).toBeUndefined()
    })
  })

  describe('Issue#63: セクションラベル', () => {
    it('通常フィルターにセクションラベルが表示される', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByText('写真のジャンル')).toBeInTheDocument()
      expect(screen.getByText('投稿の新しさ')).toBeInTheDocument()
      expect(screen.getByText('撮影時期')).toBeInTheDocument()
      expect(screen.getByText('撮影された時間帯')).toBeInTheDocument()
      expect(screen.getByText('撮影時の天候')).toBeInTheDocument()
      expect(screen.getByText('撮影の向き')).toBeInTheDocument()
    })
  })

  describe('Issue#63: 投稿の新しさ（通常フィルターに移動）', () => {
    it('上級者向けフィルターを開かずに経過期間の選択肢が表示される', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByText('1週間以内')).toBeInTheDocument()
      expect(screen.getByText('1ヶ月以内')).toBeInTheDocument()
      expect(screen.getByText('3ヶ月以内')).toBeInTheDocument()
      expect(screen.getByText('1年以内')).toBeInTheDocument()
      expect(screen.getByText('3年以内')).toBeInTheDocument()
    })
  })

  describe('Issue#63: 撮影の向き（通常フィルターに移動）', () => {
    it('上級者向けフィルターを開かずに撮影の向きの選択肢が表示される', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByText('縦位置')).toBeInTheDocument()
      expect(screen.getByText('横位置')).toBeInTheDocument()
    })

    it('横向き・縦向き・正方形の旧名称は表示されない', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.queryByText('横向き')).not.toBeInTheDocument()
      expect(screen.queryByText('縦向き')).not.toBeInTheDocument()
      expect(screen.queryByText('正方形')).not.toBeInTheDocument()
    })
  })

  describe('Issue#63: 上級者向けフィルター（3項目のみ）', () => {
    it('上級者向けフィルターを開くと機材種別・焦点距離・ISO感度のみ表示される', async () => {
      const user = userEvent.setup()
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      await user.click(screen.getByRole('button', { name: /上級者向け/ }))

      // 機材種別
      expect(screen.getByText('機材種別')).toBeInTheDocument()
      expect(screen.getByText('一眼レフ')).toBeInTheDocument()
      expect(screen.getByText('ミラーレス')).toBeInTheDocument()

      // 焦点距離
      expect(screen.getByText('焦点距離（フルサイズ換算）')).toBeInTheDocument()
      expect(screen.getByText(/広角（24mm未満）/)).toBeInTheDocument()

      // ISO感度（4段階）
      expect(screen.getByText('ISO感度')).toBeInTheDocument()
      expect(screen.getByText('ISO 400以下')).toBeInTheDocument()
      expect(screen.getByText('ISO 1600以下')).toBeInTheDocument()
      expect(screen.getByText('ISO 6400以下')).toBeInTheDocument()
      expect(screen.getByText('ISO 12800以下')).toBeInTheDocument()
    })

    it('Issue#67 - 機材種別ボタンが指定の順序で並んでいる', async () => {
      const user = userEvent.setup()
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      await user.click(screen.getByRole('button', { name: /上級者向け/ }))

      // 機材種別セクション内のボタンをdata-testid無しで取得するため、
      // 「機材種別」見出しの後に並ぶボタン群を特定
      const deviceTypeLabels = ['スマートフォン', 'ミラーレス', '一眼レフ', 'コンパクトデジカメ', 'フィルム', 'その他']
      const allButtons = screen.getAllByRole('button')
      const deviceButtons = allButtons.filter(btn => {
        const text = btn.textContent?.trim() ?? ''
        return deviceTypeLabels.includes(text) && text !== ''
      })
      // 「その他」がジャンルにも存在するため、機材種別の6つのみに絞る（後半6つ）
      const lastSixDeviceButtons = deviceButtons.slice(-6)

      expect(lastSixDeviceButtons).toHaveLength(6)
      expect(lastSixDeviceButtons[0]).toHaveTextContent('スマートフォン')
      expect(lastSixDeviceButtons[1]).toHaveTextContent('ミラーレス')
      expect(lastSixDeviceButtons[2]).toHaveTextContent('一眼レフ')
      expect(lastSixDeviceButtons[3]).toHaveTextContent('コンパクトデジカメ')
      expect(lastSixDeviceButtons[4]).toHaveTextContent('フィルム')
      expect(lastSixDeviceButtons[5]).toHaveTextContent('その他')
    })

    it('上級者向けフィルターに投稿の新しさが含まれない', async () => {
      const user = userEvent.setup()
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      // 上級者向けフィルターを開く前に経過期間が表示されていることを確認（通常フィルターにある）
      expect(screen.getByText('1週間以内')).toBeInTheDocument()

      // 上級者向けフィルターを開いても、投稿の新しさのラベルは上級者セクションにない
      await user.click(screen.getByRole('button', { name: /上級者向け/ }))

      // 投稿の新しさのラベルは通常フィルターにのみ存在する（1つだけ）
      const periodLabels = screen.getAllByText('投稿の新しさ')
      expect(periodLabels).toHaveLength(1)
    })

    it('上級者向けフィルターにアスペクト比/撮影の向きが含まれない', async () => {
      const user = userEvent.setup()
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      await user.click(screen.getByRole('button', { name: /上級者向け/ }))

      // 撮影の向きのラベルは通常フィルターにのみ存在する（1つだけ）
      const orientationLabels = screen.getAllByText('撮影の向き')
      expect(orientationLabels).toHaveLength(1)
    })
  })

  describe('Issue#63: maxAgeDays（APIパラメータ変更）', () => {
    it('onApplyコールバックにmaxAgeDaysが含まれる（maxAgeYearsではない）', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      // 経過期間を選択
      await user.click(screen.getByText('3ヶ月以内'))

      // 適用
      await user.click(screen.getByRole('button', { name: '適用' }))

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          maxAgeDays: 90,
        })
      )
      // maxAgeYearsは含まれない
      const calledWith = mockOnApply.mock.calls[0][0]
      expect(calledWith).not.toHaveProperty('maxAgeYears')
    })
  })

  describe('Issue#63: クリア動作', () => {
    it('クリアボタンで全フィルター（通常+上級者）がリセットされる', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      // 通常フィルターで選択
      await user.click(screen.getByRole('button', { name: /自然風景/ }))
      await user.click(screen.getByText('3ヶ月以内'))
      await user.click(screen.getByText('横位置'))

      // 上級者フィルターを開いて選択
      await user.click(screen.getByRole('button', { name: /上級者向け/ }))
      await user.click(screen.getByText('ミラーレス'))

      // クリア
      await user.click(screen.getByRole('button', { name: 'クリア' }))

      // クリアボタンでonApplyが空の条件で呼ばれる
      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: [],
          months: [],
          timesOfDay: [],
          weathers: [],
          maxAgeDays: undefined,
        })
      )

      // ダイアログは閉じない（閉じるボタンで閉じる）
      expect(mockOnOpenChange).not.toHaveBeenCalledWith(false)
    })

    it('最後のフィルターを解除すると自動でonApplyが空条件で呼ばれる', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      // フィルターを1つ選択
      await user.click(screen.getByText('1週間以内'))

      // 同じフィルターを再度クリックして解除
      await user.click(screen.getByText('1週間以内'))

      // 全条件がなくなったのでonApplyが空条件で呼ばれる
      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: [],
          months: [],
          timesOfDay: [],
          weathers: [],
          maxAgeDays: undefined,
        })
      )
    })
  })

  describe('UI Elements（基本）', () => {
    it('renders when open prop is true', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByText('フィルター')).toBeInTheDocument()
    })

    it('renders all month filter buttons', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

      const allButtons = screen.getAllByRole('button')
      months.forEach(month => {
        const monthButton = allButtons.find(btn =>
          btn.textContent?.trim() === month
        )
        expect(monthButton).toBeTruthy()
      })
    })

    it('renders all time of day filter buttons', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const times = ['朝', '昼', '夕方', '夜']

      const allButtons = screen.getAllByRole('button')
      times.forEach(time => {
        const timeButton = allButtons.find(btn => btn.textContent?.trim() === time)
        expect(timeButton).toBeTruthy()
      })
    })

    it('renders all weather filter buttons', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const weather = ['晴れ', '曇り', '雨', '雪']

      weather.forEach(condition => {
        expect(screen.getByRole('button', { name: new RegExp(condition) })).toBeInTheDocument()
      })
    })

    it('renders clear and apply buttons', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '適用' })).toBeInTheDocument()
    })
  })

  describe('フィルター適用', () => {
    it('選択したジャンルがonApplyに渡される', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      await user.click(screen.getByRole('button', { name: /自然風景/ }))
      await user.click(screen.getByRole('button', { name: /街並み/ }))
      await user.click(screen.getByRole('button', { name: '適用' }))

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          categories: expect.arrayContaining(['自然風景', '街並み']),
        })
      )
    })

    it('機材種別を複数選択してonApplyに配列で渡される', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      // 上級者向けフィルターを開く
      const allButtons = screen.getAllByRole('button')
      const advancedButton = allButtons.find(btn => btn.textContent?.includes('上級者向け'))
      await user.click(advancedButton!)

      // 機材種別を2つ選択
      await user.click(await screen.findByRole('button', { name: /ミラーレス/ }))
      await user.click(screen.getByRole('button', { name: /一眼レフ/ }))
      await user.click(screen.getByRole('button', { name: '適用' }))

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          deviceTypes: expect.arrayContaining(['MIRRORLESS', 'SLR']),
        })
      )
    })

    it('撮影の向きを複数選択してonApplyに配列で渡される', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      await user.click(screen.getByRole('button', { name: /縦位置/ }))
      await user.click(screen.getByRole('button', { name: /横位置/ }))
      await user.click(screen.getByRole('button', { name: '適用' }))

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          aspectRatios: expect.arrayContaining(['VERTICAL', 'HORIZONTAL']),
        })
      )
    })

    it('焦点距離を複数選択してonApplyに配列で渡される', async () => {
      const mockOnApply = vi.fn()
      const user = userEvent.setup()

      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
          onApply={mockOnApply}
        />
      )

      const allButtons = screen.getAllByRole('button')
      const advancedButton = allButtons.find(btn => btn.textContent?.includes('上級者向け'))
      await user.click(advancedButton!)

      await user.click(await screen.findByRole('button', { name: /広角/ }))
      await user.click(screen.getByRole('button', { name: /望遠（70/ }))
      await user.click(screen.getByRole('button', { name: '適用' }))

      expect(mockOnApply).toHaveBeenCalledWith(
        expect.objectContaining({
          focalLengthRanges: expect.arrayContaining(['WIDE', 'TELEPHOTO']),
        })
      )
    })

    it('何も選択していない状態では適用ボタンが無効になる', () => {
      render(
        <FilterPanel
          open={true}
          onOpenChange={mockOnOpenChange}
        />
      )

      expect(screen.getByRole('button', { name: '適用' })).toBeDisabled()
    })
  })

  describe('PC表示のレイアウト', () => {
    it('スクロール可能な内部コンテナが存在する', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByTestId('filter-scroll-container')).toBeInTheDocument()
    })

    it('焦点距離・ISO感度のボタンがテキスト折り返し可能である', async () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      // 上級者向けフィルターを開く
      const allButtons = screen.getAllByRole('button')
      const advancedButton = allButtons.find(btn => btn.textContent?.includes('上級者向け'))
      expect(advancedButton).toBeTruthy()
      await userEvent.click(advancedButton!)

      // 焦点距離ボタンがwhitespace-normalを持つ
      const focalButton = await screen.findByRole('button', { name: /広角/ })
      expect(focalButton.className).toContain('whitespace-normal')

      // ISO感度ボタンがwhitespace-normalを持つ
      const isoButton = await screen.findByRole('button', { name: /ISO 400/ })
      expect(isoButton.className).toContain('whitespace-normal')
    })
  })

  // ============================================================
  // UI改善
  // ============================================================

  describe('UI改善', () => {
    it('上級者向けボタンのラベルが「上級者向け」である', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByRole('button', { name: /上級者向け/ })).toBeInTheDocument()
      expect(screen.queryByText(/上級者向けフィルター/)).not.toBeInTheDocument()
    })

    it('撮影の向きセクションが表示される（写真の向きではない）', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByText('撮影の向き')).toBeInTheDocument()
      expect(screen.queryByText('写真の向き')).not.toBeInTheDocument()
    })

    it('「縦位置」「横位置」ボタンが表示され、「正方形」は表示されない', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      expect(screen.getByRole('button', { name: /縦位置/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /横位置/ })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /正方形/ })).not.toBeInTheDocument()
    })
  })

  describe('タッチ操作: スクロール時の選択取り消し', () => {
    it('ボタンをpointerDownで即座に選択できる', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const button = screen.getByRole('button', { name: /自然風景/ })
      fireEvent.pointerDown(button)

      // 即座に選択状態になる
      expect(button.className).toContain('bg-primary')
    })

    it('ボタン選択後にスクロールが発生すると選択が取り消される', () => {
      render(<FilterPanel open={true} onOpenChange={mockOnOpenChange} />)

      const button = screen.getByRole('button', { name: /自然風景/ })
      fireEvent.pointerDown(button)

      // 選択された
      expect(button.className).toContain('bg-primary')

      // スクロールが発生
      const scrollContainer = screen.getByTestId('filter-scroll-container')
      fireEvent.scroll(scrollContainer)

      // 選択が取り消される
      expect(button.className).not.toContain('bg-primary')
    })
  })
})
