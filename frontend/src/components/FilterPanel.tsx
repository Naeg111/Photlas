import { useState, useRef, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"
import { Button } from "./ui/button"
import { CategoryIcon } from "./CategoryIcon"
import { MonthIcons, TimeIcons, WeatherIcons, OrientationIcons } from "./FilterIcons"
import { ChevronDown, ChevronUp } from "lucide-react"
import { PHOTO_CATEGORIES } from "../utils/constants"
import { fetchTags } from "../utils/tagsApi"
import { KeywordSection, type KeywordTag } from "./KeywordSection"
import { CATEGORY_LABELS } from "../utils/codeConstants"

/** Issue#135: 検索フィルタで選択された日本語カテゴリ名 → カテゴリコードへ変換するマップ。 */
const CATEGORY_NAME_TO_FILTER_CODE: Record<string, number> = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([code, name]) => [name, Number(code)])
)


const MONTHS_NEED_INVERT = new Set(["1月", "2月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]);
const TIMES_NEED_INVERT = new Set(["夕方"]);
// OrientationIconsはfill="currentColor"のためinvert不要（テキスト色に追従）

// カテゴリ名から翻訳キーへのマッピング
const CATEGORY_TO_I18N_KEY: Record<string, string> = {
  '自然風景': 'categories.nature',
  '街並み': 'categories.cityscape',
  '建造物': 'categories.architecture',
  '夜景': 'categories.nightscape',
  'グルメ': 'categories.gourmet',
  '植物': 'categories.plants',
  '動物': 'categories.animals',
  '野鳥': 'categories.birds',
  '自動車': 'categories.cars',
  'バイク': 'categories.motorcycles',
  '鉄道': 'categories.railways',
  '飛行機': 'categories.aircraft',
  '星空': 'categories.starrysky',
  'その他': 'categories.other',
}

// Issue#63: 上級者向けフィルターの選択肢（機材種別・焦点距離・ISO感度のみ）
const DEVICE_TYPE_OPTION_VALUES = [
  { key: "deviceType.smartphone", value: "SMARTPHONE" },
  { key: "deviceType.mirrorless", value: "MIRRORLESS" },
  { key: "deviceType.slr", value: "SLR" },
  { key: "deviceType.compact", value: "COMPACT" },
  { key: "deviceType.film", value: "FILM" },
  { key: "deviceType.other", value: "OTHER" },
]

// Issue#63: 投稿の新しさ（通常フィルターに移動、3ヶ月以内追加）
const FRESHNESS_OPTION_VALUES = [
  { key: "filter.freshness1w", value: 7 },
  { key: "filter.freshness1m", value: 30 },
  { key: "filter.freshness3m", value: 90 },
  { key: "filter.freshness1y", value: 365 },
  { key: "filter.freshness3y", value: 1095 },
]

// Issue#63: 撮影の向き（通常フィルターに移動、名称変更）
const ASPECT_RATIO_OPTION_VALUES = [
  { key: "filter.vertical", value: "VERTICAL", iconKey: "縦位置" },
  { key: "filter.horizontal", value: "HORIZONTAL", iconKey: "横位置" },
]

const FOCAL_LENGTH_OPTION_VALUES = [
  { key: "filter.wideAngle", value: "WIDE" },
  { key: "filter.standard", value: "STANDARD" },
  { key: "filter.telephoto", value: "TELEPHOTO" },
  { key: "filter.superTelephoto", value: "SUPER_TELEPHOTO" },
]

// Issue#63: ISO感度の選択肢を4段階に拡張
const ISO_OPTION_VALUES = [
  { key: "filter.iso400", value: 400 },
  { key: "filter.iso1600", value: 1600 },
  { key: "filter.iso6400", value: 6400 },
  { key: "filter.iso12800", value: 12800 },
]

const MONTH_KEYS = [
  { key: "months.jan", label: "1月" },
  { key: "months.feb", label: "2月" },
  { key: "months.mar", label: "3月" },
  { key: "months.apr", label: "4月" },
  { key: "months.may", label: "5月" },
  { key: "months.jun", label: "6月" },
  { key: "months.jul", label: "7月" },
  { key: "months.aug", label: "8月" },
  { key: "months.sep", label: "9月" },
  { key: "months.oct", label: "10月" },
  { key: "months.nov", label: "11月" },
  { key: "months.dec", label: "12月" },
]

const TIME_OF_DAY_KEYS = [
  { key: "timeOfDay.morning", label: "朝" },
  { key: "timeOfDay.afternoon", label: "昼" },
  { key: "timeOfDay.evening", label: "夕方" },
  { key: "timeOfDay.night", label: "夜" },
]

const WEATHER_KEYS = [
  { key: "weather.sunny", label: "晴れ" },
  { key: "weather.cloudy", label: "曇り" },
  { key: "weather.rainy", label: "雨" },
  { key: "weather.snowy", label: "雪" },
]

export interface FilterConditions {
  categories: string[]
  months: string[]
  timesOfDay: string[]
  weathers: string[]
  maxAgeDays?: number
  aspectRatios?: string[]
  deviceTypes?: string[]
  focalLengthRanges?: string[]
  maxIso?: number
  /** Issue#135: 検索フィルタのキーワード ID（AND 検索、最大 10 件） */
  tagIds?: number[]
}

interface FilterPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply?: (conditions: FilterConditions) => void
}

// フィルターボタン共通スタイル（モバイルタッチ対応: onPointerDownで即座に反応）
const FILTER_BTN_BASE = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors [&_svg]:shrink-0 [&_svg]:w-5 [&_svg]:h-5"
const FILTER_BTN_BORDER = { border: '1px solid #d1d5db' } as const

function FilterButton({ selected, onPointerDown, className, children }: Readonly<{
  selected: boolean
  onPointerDown: () => void
  className?: string
  children: React.ReactNode
}>) {
  return (
    <button
      type="button"
      className={`${FILTER_BTN_BASE} h-9 gap-2 ${selected ? "bg-primary text-primary-foreground" : "bg-background text-foreground"} ${className || ""}`}
      style={FILTER_BTN_BORDER}
      onPointerDown={(e) => {
        e.preventDefault()
        onPointerDown()
      }}
    >
      {children}
    </button>
  )
}

export function FilterPanel({ open, onOpenChange, onApply }: Readonly<FilterPanelProps>) {
  const { t, i18n } = useTranslation()

  // 基本フィルターの状態
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [selectedTimes, setSelectedTimes] = useState<string[]>([])
  const [selectedWeather, setSelectedWeather] = useState<string[]>([])
  const [selectedMaxAgeDays, setSelectedMaxAgeDays] = useState<number | undefined>(undefined)
  const [selectedAspectRatios, setSelectedAspectRatios] = useState<string[]>([])

  // 上級者向けフィルターの状態
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [selectedDeviceTypes, setSelectedDeviceTypes] = useState<string[]>([])
  const [selectedFocalLengthRanges, setSelectedFocalLengthRanges] = useState<string[]>([])
  const [selectedMaxIso, setSelectedMaxIso] = useState<number | undefined>(undefined)

  // Issue#135: キーワードフィルタの状態（最大 10 件の AND 検索）
  const [allTags, setAllTags] = useState<KeywordTag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])

  // パネルを開いたタイミングで全アクティブタグを取得
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetchTags(i18n.language, { signal: controller.signal })
      .then((res) => setAllTags(res.tags))
      .catch(() => {
        // 取得失敗は静かに無視（フィルタの他項目だけでも動作する）
      })
    return () => controller.abort()
  }, [open, i18n.language])

  // スクロール時の選択取り消し機構
  const lastToggleRef = useRef<(() => void) | null>(null)

  const handleScrollDuringToggle = useCallback(() => {
    if (lastToggleRef.current) {
      lastToggleRef.current() // 直前のトグルを取り消す（再トグル）
      lastToggleRef.current = null
    }
  }, [])

  // pointerup で取り消しをクリア（タップ完了 = 確定）
  const handlePointerUp = useCallback(() => {
    lastToggleRef.current = null
  }, [])

  const toggleSelection = (
    value: string,
    selected: string[],
    setSelected: (values: string[]) => void
  ) => {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value));
    } else {
      setSelected([...selected, value]);
    }
    // 取り消し用に逆操作を記録（スクロール発生時にリバート）
    lastToggleRef.current = () => {
      if (selected.includes(value)) {
        setSelected([...selected])
      } else {
        setSelected(selected.filter((v) => v !== value))
      }
    }
  };

  // 単一選択のトグル（経過期間、ISO感度など）
  const toggleSingleSelection = <T,>(
    value: T,
    current: T | undefined,
    setSetter: (v: T | undefined) => void
  ) => {
    const prev = current
    setSetter(current === value ? undefined : value)
    // 取り消し用
    lastToggleRef.current = () => setSetter(prev)
  };

  const handleClear = () => {
    setSelectedCategories([])
    setSelectedMonths([])
    setSelectedTimes([])
    setSelectedWeather([])
    setSelectedMaxAgeDays(undefined)
    setSelectedAspectRatios([])
    setSelectedDeviceTypes([])
    setSelectedFocalLengthRanges([])
    setSelectedMaxIso(undefined)
    setSelectedTagIds([])

    onApply?.({
      categories: [],
      months: [],
      timesOfDay: [],
      weathers: [],
      maxAgeDays: undefined,
      aspectRatios: [],
      deviceTypes: [],
      focalLengthRanges: [],
      maxIso: undefined,
      tagIds: [],
    })
  }

  const hasAnyFilter =
    selectedCategories.length > 0 ||
    selectedMonths.length > 0 ||
    selectedTimes.length > 0 ||
    selectedWeather.length > 0 ||
    selectedMaxAgeDays !== undefined ||
    selectedAspectRatios.length > 0 ||
    selectedDeviceTypes.length > 0 ||
    selectedFocalLengthRanges.length > 0 ||
    selectedMaxIso !== undefined ||
    selectedTagIds.length > 0

  // フィルター条件がすべて解除されたら自動でonApplyを呼ぶ
  const hadFilterRef = useRef(false)
  useEffect(() => {
    if (hadFilterRef.current && !hasAnyFilter) {
      onApply?.({
        categories: [],
        months: [],
        timesOfDay: [],
        weathers: [],
        maxAgeDays: undefined,
        aspectRatios: [],
        deviceTypes: [],
        focalLengthRanges: [],
        maxIso: undefined,
        tagIds: [],
      })
    }
    hadFilterRef.current = hasAnyFilter
  }, [hasAnyFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = () => {
    if (onApply) {
      onApply({
        categories: selectedCategories,
        months: selectedMonths,
        timesOfDay: selectedTimes,
        weathers: selectedWeather,
        maxAgeDays: selectedMaxAgeDays,
        aspectRatios: selectedAspectRatios,
        deviceTypes: selectedDeviceTypes,
        focalLengthRanges: selectedFocalLengthRanges,
        maxIso: selectedMaxIso,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="w-full h-full md:w-[70%] md:h-auto md:max-h-[90vh] md:left-[15%] md:rounded-b-lg md:overflow-hidden flex flex-col">
        <div className="px-6 pt-[calc(1.5rem+var(--safe-area-top))] pb-2 shrink-0">
          <SheetHeader className="p-0 gap-2 text-center">
            <SheetTitle className="text-lg leading-none font-semibold">{t('filter.title')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('filter.description')}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div data-testid="filter-scroll-container" className="flex-1 min-h-0 overflow-y-auto px-6 pb-6" style={{ touchAction: 'manipulation' }} onScroll={handleScrollDuringToggle} onPointerUp={handlePointerUp}>
        <div className="space-y-[30px] pb-6 mt-4">
          {/* Issue#63: 写真のジャンル */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">{t('filter.genre')}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {PHOTO_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <FilterButton
                    key={category}
                    selected={isSelected}
                    onPointerDown={() => toggleSelection(category, selectedCategories, setSelectedCategories)}
                  >
                    <CategoryIcon category={category} className="w-5 h-5 shrink-0" />
                    <span className="truncate">{t(CATEGORY_TO_I18N_KEY[category] ?? category)}</span>
                  </FilterButton>
                );
              })}
            </div>
          </div>

          {/* Issue#135: キーワードフィルタ (カテゴリと投稿時期の間に配置) */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">
              {t('filter.keywords', { defaultValue: 'キーワード' })}
            </p>
            <KeywordSection
              allTags={allTags}
              aiSuggestions={[]}
              selectedCategoryCodes={selectedCategories
                .map((name) => CATEGORY_NAME_TO_FILTER_CODE[name])
                .filter((id): id is number => typeof id === 'number')}
              selectedTagIds={selectedTagIds}
              onSelectionChange={setSelectedTagIds}
              maxSelections={10}
              // Issue#141 Phase 8: フィルタ画面ではカテゴリ選択で配下キーワードを自動選択
              autoSelectByCategoryMode
            />
          </div>

          {/* Issue#63: 投稿時期（通常フィルターに移動） */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">{t('filter.postDate')}</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {FRESHNESS_OPTION_VALUES.map((option) => (
                <FilterButton
                  key={option.key}
                  selected={selectedMaxAgeDays === option.value}
                  onPointerDown={() => toggleSingleSelection(option.value, selectedMaxAgeDays, setSelectedMaxAgeDays)}
                >
                  {t(option.key)}
                </FilterButton>
              ))}
            </div>
          </div>

          {/* 撮影時期 */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">{t('filter.shootingPeriod')}</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {MONTH_KEYS.map(({ key, label }) => {
                const Icon = MonthIcons[label];
                const isSelected = selectedMonths.includes(label);
                const needsInvert = MONTHS_NEED_INVERT.has(label);
                return (
                  <FilterButton
                    key={label}
                    selected={isSelected}
                    onPointerDown={() => toggleSelection(label, selectedMonths, setSelectedMonths)}
                    className={`gap-1.5 px-2 ${isSelected && needsInvert ? "[&_svg]:invert" : ""}`}
                  >
                    {Icon && <Icon className="w-5 h-5 shrink-0" />}
                    <span className="text-sm">{t(key)}</span>
                  </FilterButton>
                );
              })}
            </div>
          </div>

          {/* 撮影された時間帯 */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">{t('filter.timeOfDay')}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TIME_OF_DAY_KEYS.map(({ key, label }) => {
                const Icon = TimeIcons[label];
                const isSelected = selectedTimes.includes(label);
                const needsInvert = TIMES_NEED_INVERT.has(label);
                return (
                  <FilterButton
                    key={label}
                    selected={isSelected}
                    onPointerDown={() => toggleSelection(label, selectedTimes, setSelectedTimes)}
                    className={isSelected && needsInvert ? "[&_svg]:invert" : ""}
                  >
                    {Icon && <Icon className="w-6 h-6 shrink-0" />}
                    <span>{t(key)}</span>
                  </FilterButton>
                );
              })}
            </div>
          </div>

          {/* 撮影時の天候 */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">{t('filter.weather')}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {WEATHER_KEYS.map(({ key, label }) => {
                const Icon = WeatherIcons[label];
                const isSelected = selectedWeather.includes(label);
                return (
                  <FilterButton
                    key={label}
                    selected={isSelected}
                    onPointerDown={() => toggleSelection(label, selectedWeather, setSelectedWeather)}
                  >
                    {Icon && <Icon className="w-6 h-6 shrink-0" />}
                    <span>{t(key)}</span>
                  </FilterButton>
                );
              })}
            </div>
          </div>

          {/* Issue#63: 撮影の向き（通常フィルターに移動） */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">{t('filter.orientation')}</p>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIO_OPTION_VALUES.map((option) => {
                const Icon = OrientationIcons[option.iconKey];
                const isSelected = selectedAspectRatios.includes(option.value);
                return (
                <FilterButton
                  key={option.key}
                  selected={isSelected}
                  onPointerDown={() => toggleSelection(option.value, selectedAspectRatios, setSelectedAspectRatios)}
                  className="gap-1.5 px-2"
                >
                  {Icon && <Icon className="w-5 h-5 shrink-0" />}
                  <span>{t(option.key)}</span>
                </FilterButton>
                );
              })}
            </div>
          </div>

          {/* 上級者向けフィルタートグル */}
          <div>
            <Button
              variant="ghost"
              className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            >
              {t('filter.advanced')}
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {isAdvancedOpen && (
              <div className="space-y-[30px] mt-4">
                {/* 機材種別 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">{t('filter.deviceType')}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {DEVICE_TYPE_OPTION_VALUES.map((option) => {
                      const isSelected = selectedDeviceTypes.includes(option.value);
                      return (
                      <FilterButton
                        key={option.key}
                        selected={isSelected}
                        onPointerDown={() => toggleSelection(option.value, selectedDeviceTypes, setSelectedDeviceTypes)}
                      >
                        {t(option.key)}
                      </FilterButton>
                      );
                    })}
                  </div>
                </div>

                {/* 焦点距離 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">{t('filter.focalLength')}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {FOCAL_LENGTH_OPTION_VALUES.map((option) => {
                      const isSelected = selectedFocalLengthRanges.includes(option.value);
                      return (
                      <FilterButton
                        key={option.key}
                        selected={isSelected}
                        onPointerDown={() => toggleSelection(option.value, selectedFocalLengthRanges, setSelectedFocalLengthRanges)}
                        className="whitespace-normal h-auto py-2"
                      >
                        {t(option.key)}
                      </FilterButton>
                      );
                    })}
                  </div>
                </div>

                {/* ISO感度 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">{t('filter.isoSensitivity')}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {ISO_OPTION_VALUES.map((option) => (
                      <FilterButton
                        key={option.key}
                        selected={selectedMaxIso === option.value}
                        onPointerDown={() => toggleSingleSelection(option.value, selectedMaxIso, setSelectedMaxIso)}
                        className="whitespace-normal h-auto py-2"
                      >
                        {t(option.key)}
                      </FilterButton>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
        </div>

        {/* 適用・クリアボタン（スクロール外に固定） */}
        <div className="flex gap-2 px-6 py-4 border-t bg-background shrink-0">
          <Button variant="outline" className="flex-1" onClick={handleClear}>
            {t('common.clear')}
          </Button>
          <Button className="flex-1" onClick={handleApply} disabled={!hasAnyFilter}>
            {t('common.apply')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
