import { useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet"
import { Button } from "./ui/button"
import { CategoryIcon } from "./CategoryIcon"
import { MonthIcons, TimeIcons, WeatherIcons } from "./FilterIcons"
import { ChevronDown, ChevronUp } from "lucide-react"
import { PHOTO_CATEGORIES } from "../utils/constants"

const CATEGORIES_NEED_INVERT: string[] = [];
const MONTHS_NEED_INVERT = ["1月", "2月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const TIMES_NEED_INVERT = ["夕方"];

// Issue#63: 上級者向けフィルターの選択肢（機材種別・焦点距離・ISO感度のみ）
const DEVICE_TYPE_OPTIONS = [
  { label: "スマートフォン", value: "SMARTPHONE" },
  { label: "ミラーレス", value: "MIRRORLESS" },
  { label: "一眼レフ", value: "SLR" },
  { label: "コンパクトデジカメ", value: "COMPACT" },
  { label: "フィルム", value: "FILM" },
  { label: "その他", value: "OTHER" },
]

// Issue#63: 撮影日からの経過期間（通常フィルターに移動、3ヶ月以内追加）
const FRESHNESS_OPTIONS = [
  { label: "1週間以内", value: 7 },
  { label: "1ヶ月以内", value: 30 },
  { label: "3ヶ月以内", value: 90 },
  { label: "1年以内", value: 365 },
  { label: "3年以内", value: 1095 },
]

// Issue#63: 写真の向き（通常フィルターに移動、名称変更）
const ASPECT_RATIO_OPTIONS = [
  { label: "横向き", value: "HORIZONTAL" },
  { label: "縦向き", value: "VERTICAL" },
  { label: "正方形", value: "SQUARE" },
]

const FOCAL_LENGTH_OPTIONS = [
  { label: "広角（24mm未満）", value: "WIDE" },
  { label: "標準（24-70mm）", value: "STANDARD" },
  { label: "望遠（70-300mm）", value: "TELEPHOTO" },
  { label: "超望遠（300mm超）", value: "SUPER_TELEPHOTO" },
]

// Issue#63: ISO感度の選択肢を4段階に拡張
const ISO_OPTIONS = [
  { label: "ISO 400以下", value: 400 },
  { label: "ISO 1600以下", value: 1600 },
  { label: "ISO 6400以下", value: 6400 },
  { label: "ISO 12800以下", value: 12800 },
]

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
]

const TIME_OF_DAY = ["朝", "昼", "夕方", "夜"]
const WEATHER = ["晴れ", "曇り", "雨", "雪"]

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
}

interface FilterPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply?: (conditions: FilterConditions) => void
}

// フィルターボタン共通スタイル（モバイルタッチ対応: onPointerDownで即座に反応）
const FILTER_BTN_BASE = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors [&_svg]:shrink-0 [&_svg]:w-5 [&_svg]:h-5"
const FILTER_BTN_BORDER = { border: '1px solid #d1d5db' } as const

function FilterButton({ selected, onClick, className, children }: {
  selected: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={`${FILTER_BTN_BASE} h-9 gap-2 ${selected ? "bg-primary text-primary-foreground" : "bg-background text-foreground"} ${className || ""}`}
      style={FILTER_BTN_BORDER}
      onPointerDown={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

export function FilterPanel({ open, onOpenChange, onApply }: FilterPanelProps) {
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
  }

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
      });
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="w-full h-full md:w-[70%] md:max-h-[90vh] md:left-[15%] md:rounded-b-lg md:overflow-hidden">
        <SheetHeader className="sr-only">
          <SheetTitle>フィルター</SheetTitle>
          <SheetDescription>
            ジャンル、時期、時間帯、天候でフィルタリング
          </SheetDescription>
        </SheetHeader>

        <div data-testid="filter-scroll-container" className="h-full overflow-y-auto px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))]" style={{ touchAction: 'manipulation' }}>
        <div className="space-y-[30px] pb-6 mt-[40px]">
          {/* Issue#63: 写真のジャンル */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">写真のジャンル</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {PHOTO_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category);
                const needsInvert = CATEGORIES_NEED_INVERT.includes(category);
                return (
                  <FilterButton
                    key={category}
                    selected={isSelected}
                    onClick={() => toggleSelection(category, selectedCategories, setSelectedCategories)}
                    className={isSelected && needsInvert ? "[&_svg]:invert" : ""}
                  >
                    <CategoryIcon category={category} className="w-5 h-5 shrink-0" />
                    <span className="truncate">{category}</span>
                  </FilterButton>
                );
              })}
            </div>
          </div>

          {/* Issue#63: 撮影日からの経過期間（通常フィルターに移動） */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">撮影日からの経過期間</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {FRESHNESS_OPTIONS.map((option) => (
                <FilterButton
                  key={option.label}
                  selected={selectedMaxAgeDays === option.value}
                  onClick={() => setSelectedMaxAgeDays(
                    selectedMaxAgeDays === option.value ? undefined : option.value
                  )}
                >
                  {option.label}
                </FilterButton>
              ))}
            </div>
          </div>

          {/* 撮影時期 */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">撮影時期</p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {MONTHS.map((month) => {
                const Icon = MonthIcons[month];
                const isSelected = selectedMonths.includes(month);
                const needsInvert = MONTHS_NEED_INVERT.includes(month);
                return (
                  <FilterButton
                    key={month}
                    selected={isSelected}
                    onClick={() => toggleSelection(month, selectedMonths, setSelectedMonths)}
                    className={`gap-1.5 px-2 ${isSelected && needsInvert ? "[&_svg]:invert" : ""}`}
                  >
                    {Icon && <Icon className="w-5 h-5 shrink-0" />}
                    <span className="text-sm">{month}</span>
                  </FilterButton>
                );
              })}
            </div>
          </div>

          {/* 撮影された時間帯 */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">撮影された時間帯</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TIME_OF_DAY.map((time) => {
                const Icon = TimeIcons[time];
                const isSelected = selectedTimes.includes(time);
                const needsInvert = TIMES_NEED_INVERT.includes(time);
                return (
                  <FilterButton
                    key={time}
                    selected={isSelected}
                    onClick={() => toggleSelection(time, selectedTimes, setSelectedTimes)}
                    className={isSelected && needsInvert ? "[&_svg]:invert" : ""}
                  >
                    {Icon && <Icon className="w-6 h-6 shrink-0" />}
                    <span>{time}</span>
                  </FilterButton>
                );
              })}
            </div>
          </div>

          {/* 撮影時の天候 */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">撮影時の天候</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {WEATHER.map((weather) => {
                const Icon = WeatherIcons[weather];
                const isSelected = selectedWeather.includes(weather);
                return (
                  <FilterButton
                    key={weather}
                    selected={isSelected}
                    onClick={() => toggleSelection(weather, selectedWeather, setSelectedWeather)}
                  >
                    {Icon && <Icon className="w-6 h-6 shrink-0" />}
                    <span>{weather}</span>
                  </FilterButton>
                );
              })}
            </div>
          </div>

          {/* Issue#63: 写真の向き（通常フィルターに移動） */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">写真の向き</p>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_RATIO_OPTIONS.map((option) => {
                const isSelected = selectedAspectRatios.includes(option.value);
                return (
                <FilterButton
                  key={option.label}
                  selected={isSelected}
                  onClick={() => toggleSelection(option.value, selectedAspectRatios, setSelectedAspectRatios)}
                >
                  {option.label}
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
              上級者向けフィルター
              {isAdvancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {isAdvancedOpen && (
              <div className="space-y-[30px] mt-4">
                {/* 機材種別 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">機材種別</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {DEVICE_TYPE_OPTIONS.map((option) => {
                      const isSelected = selectedDeviceTypes.includes(option.value);
                      return (
                      <FilterButton
                        key={option.label}
                        selected={isSelected}
                        onClick={() => toggleSelection(option.value, selectedDeviceTypes, setSelectedDeviceTypes)}
                      >
                        {option.label}
                      </FilterButton>
                      );
                    })}
                  </div>
                </div>

                {/* 焦点距離 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">焦点距離（フルサイズ換算）</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {FOCAL_LENGTH_OPTIONS.map((option) => {
                      const isSelected = selectedFocalLengthRanges.includes(option.value);
                      return (
                      <FilterButton
                        key={option.label}
                        selected={isSelected}
                        onClick={() => toggleSelection(option.value, selectedFocalLengthRanges, setSelectedFocalLengthRanges)}
                        className="whitespace-normal h-auto py-2"
                      >
                        {option.label}
                      </FilterButton>
                      );
                    })}
                  </div>
                </div>

                {/* ISO感度 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">ISO感度</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {ISO_OPTIONS.map((option) => (
                      <FilterButton
                        key={option.label}
                        selected={selectedMaxIso === option.value}
                        onClick={() => setSelectedMaxIso(
                          selectedMaxIso === option.value ? undefined : option.value
                        )}
                        className="whitespace-normal h-auto py-2"
                      >
                        {option.label}
                      </FilterButton>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 適用・クリアボタン */}
          <div className="flex gap-2 sticky bottom-0 bg-background py-4">
            <Button variant="outline" className="flex-1" onClick={handleClear}>
              クリア
            </Button>
            <Button className="flex-1" onClick={handleApply}>
              適用
            </Button>
          </div>
        </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
