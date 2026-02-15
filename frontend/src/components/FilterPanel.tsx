import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { CategoryIcon } from "./CategoryIcon";
import { MonthIcons, TimeIcons, WeatherIcons } from "./FilterIcons";
import { PHOTO_CATEGORIES } from "../utils/constants";
import { ChevronDown, ChevronUp, X } from "lucide-react";

export interface FilterConditions {
  categories: string[];
  months: string[];
  timesOfDay: string[];
  weathers: string[];
  tags: string[];
  deviceType?: string;
  maxAgeYears?: number;
  aspectRatio?: string;
  focalLengthRange?: string;
  maxIso?: number;
}

interface FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply?: (conditions: FilterConditions) => void;
}

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

const TIME_OF_DAY = ["朝", "昼", "夕方", "夜"];

const WEATHER = ["晴れ", "曇り", "雨", "雪"];

// カテゴリアイコンは全て fill="currentColor" のため invert 不要
const CATEGORIES_NEED_INVERT: string[] = [];

// アイコンが fill="#000000" でハードコードされているため、選択時に invert が必要な月（3月以外）
const MONTHS_NEED_INVERT = ["1月", "2月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// アイコンが fill="#000000" でハードコードされているため、選択時に invert が必要な時間帯
const TIMES_NEED_INVERT = ["夕方"];

// Issue#46: 詳細フィルターの選択肢
const DEVICE_TYPE_OPTIONS = [
  { label: "一眼レフ", value: "SLR" },
  { label: "ミラーレス", value: "MIRRORLESS" },
  { label: "コンパクトデジカメ", value: "COMPACT" },
  { label: "スマートフォン", value: "SMARTPHONE" },
  { label: "フィルム", value: "FILM" },
  { label: "その他", value: "OTHER" },
] as const;

const FRESHNESS_OPTIONS = [
  { label: "1週間以内", value: 7 },
  { label: "1ヶ月以内", value: 30 },
  { label: "1年以内", value: 365 },
  { label: "3年以内", value: 1095 },
] as const;

const ASPECT_RATIO_OPTIONS = [
  { label: "横位置", value: "HORIZONTAL" },
  { label: "縦位置", value: "VERTICAL" },
  { label: "正方形", value: "SQUARE" },
] as const;

const FOCAL_LENGTH_OPTIONS = [
  { label: "広角（24mm未満）", value: "WIDE" },
  { label: "標準（24-70mm）", value: "STANDARD" },
  { label: "望遠（70-300mm）", value: "TELEPHOTO" },
  { label: "超望遠（301mm以上）", value: "SUPER_TELEPHOTO" },
] as const;

const ISO_OPTIONS = [
  { label: "低感度（ISO 400以下）", value: 400 },
] as const;

export function FilterPanel({ open, onOpenChange, onApply }: FilterPanelProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedWeather, setSelectedWeather] = useState<string[]>([]);

  // Issue#47: タグフィルターの状態
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Issue#46: 詳細フィルターの状態
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | undefined>(undefined);
  const [selectedMaxAgeYears, setSelectedMaxAgeYears] = useState<number | undefined>(undefined);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | undefined>(undefined);
  const [selectedFocalLengthRange, setSelectedFocalLengthRange] = useState<string | undefined>(undefined);
  const [selectedMaxIso, setSelectedMaxIso] = useState<number | undefined>(undefined);

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
    setSelectedCategories([]);
    setSelectedMonths([]);
    setSelectedTimes([]);
    setSelectedWeather([]);
    setTags([]);
    setTagInput('');
    setSelectedDeviceType(undefined);
    setSelectedMaxAgeYears(undefined);
    setSelectedAspectRatio(undefined);
    setSelectedFocalLengthRange(undefined);
    setSelectedMaxIso(undefined);
  };

  const handleApply = () => {
    if (onApply) {
      onApply({
        categories: selectedCategories,
        months: selectedMonths,
        timesOfDay: selectedTimes,
        weathers: selectedWeather,
        tags,
        deviceType: selectedDeviceType,
        maxAgeYears: selectedMaxAgeYears,
        aspectRatio: selectedAspectRatio,
        focalLengthRange: selectedFocalLengthRange,
        maxIso: selectedMaxIso,
      });
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="w-full h-full md:max-h-[90vh] px-6 py-6 overflow-y-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>フィルター</SheetTitle>
          <SheetDescription>
            被写体種別、時期、時間帯、天候でフィルタリング
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 pb-6 mt-[35px]">
          {/* 被写体種別 */}
          <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {PHOTO_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category);
                const needsInvert = CATEGORIES_NEED_INVERT.includes(category);
                return (
                  <Button
                    key={category}
                    variant={isSelected ? "default" : "outline"}
                    className={`flex items-center gap-2 justify-center ${isSelected ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"} ${isSelected && needsInvert ? "[&_svg]:invert" : ""}`}
                    style={{ border: '1px solid #d1d5db' }}
                    onClick={() =>
                      toggleSelection(category, selectedCategories, setSelectedCategories)
                    }
                  >
                    <CategoryIcon category={category} className="w-5 h-5 shrink-0" />
                    <span className="truncate">{category}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 時期 */}
          <div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {MONTHS.map((month) => {
                const Icon = MonthIcons[month];
                const isSelected = selectedMonths.includes(month);
                const needsInvert = MONTHS_NEED_INVERT.includes(month);
                return (
                  <Button
                    key={month}
                    variant={isSelected ? "default" : "outline"}
                    className={`flex items-center gap-1.5 justify-center px-2 ${isSelected ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"} ${isSelected && needsInvert ? "[&_svg]:invert" : ""}`}
                    style={{ border: '1px solid #d1d5db' }}
                    onClick={() =>
                      toggleSelection(month, selectedMonths, setSelectedMonths)
                    }
                  >
                    {Icon && <Icon className="w-5 h-5 shrink-0" />}
                    <span className="text-sm">{month}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 時間帯 */}
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TIME_OF_DAY.map((time) => {
                const Icon = TimeIcons[time];
                const isSelected = selectedTimes.includes(time);
                const needsInvert = TIMES_NEED_INVERT.includes(time);
                return (
                  <Button
                    key={time}
                    variant={isSelected ? "default" : "outline"}
                    className={`flex items-center gap-2 justify-center ${isSelected ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"} ${isSelected && needsInvert ? "[&_svg]:invert" : ""}`}
                    style={{ border: '1px solid #d1d5db' }}
                    onClick={() =>
                      toggleSelection(time, selectedTimes, setSelectedTimes)
                    }
                  >
                    {Icon && <Icon className="w-6 h-6 shrink-0" />}
                    <span>{time}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* 天候 */}
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {WEATHER.map((weather) => {
                const Icon = WeatherIcons[weather];
                const isSelected = selectedWeather.includes(weather);
                return (
                  <Button
                    key={weather}
                    variant={isSelected ? "default" : "outline"}
                    className={`flex items-center gap-2 justify-center ${isSelected ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"}`}
                    style={{ border: '1px solid #d1d5db' }}
                    onClick={() =>
                      toggleSelection(weather, selectedWeather, setSelectedWeather)
                    }
                  >
                    {Icon && <Icon className="w-6 h-6 shrink-0" />}
                    <span>{weather}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Issue#47: タグフィルター */}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  data-testid="filter-tag-chip"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    className="ml-1 hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="タグを入力"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const trimmed = tagInput.trim()
                  if (trimmed && !tags.includes(trimmed)) {
                    setTags([...tags, trimmed])
                    setTagInput('')
                  }
                }
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Issue#46: 詳細フィルタートグル */}
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
              <div className="space-y-6 mt-4">
                {/* 機材種別 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">機材種別</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {DEVICE_TYPE_OPTIONS.map((option) => (
                      <Button
                        key={option.label}
                        variant={selectedDeviceType === option.value ? "default" : "outline"}
                        className={`text-sm ${selectedDeviceType === option.value ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"}`}
                        style={{ border: '1px solid #d1d5db' }}
                        onClick={() => setSelectedDeviceType(
                          selectedDeviceType === option.value ? undefined : option.value
                        )}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 鮮度 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">鮮度</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {FRESHNESS_OPTIONS.map((option) => (
                      <Button
                        key={option.label}
                        variant={selectedMaxAgeYears === option.value ? "default" : "outline"}
                        className={`text-sm ${selectedMaxAgeYears === option.value ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"}`}
                        style={{ border: '1px solid #d1d5db' }}
                        onClick={() => setSelectedMaxAgeYears(
                          selectedMaxAgeYears === option.value ? undefined : option.value
                        )}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* アスペクト比 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">アスペクト比</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECT_RATIO_OPTIONS.map((option) => (
                      <Button
                        key={option.label}
                        variant={selectedAspectRatio === option.value ? "default" : "outline"}
                        className={`text-sm ${selectedAspectRatio === option.value ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"}`}
                        style={{ border: '1px solid #d1d5db' }}
                        onClick={() => setSelectedAspectRatio(
                          selectedAspectRatio === option.value ? undefined : option.value
                        )}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* 焦点距離 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">焦点距離（フルサイズ換算）</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {FOCAL_LENGTH_OPTIONS.map((option) => (
                      <Button
                        key={option.label}
                        variant={selectedFocalLengthRange === option.value ? "default" : "outline"}
                        className={`text-sm ${selectedFocalLengthRange === option.value ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"}`}
                        style={{ border: '1px solid #d1d5db' }}
                        onClick={() => setSelectedFocalLengthRange(
                          selectedFocalLengthRange === option.value ? undefined : option.value
                        )}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* ISO感度 */}
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">ISO感度</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ISO_OPTIONS.map((option) => (
                      <Button
                        key={option.label}
                        variant={selectedMaxIso === option.value ? "default" : "outline"}
                        className={`text-sm ${selectedMaxIso === option.value ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"}`}
                        style={{ border: '1px solid #d1d5db' }}
                        onClick={() => setSelectedMaxIso(
                          selectedMaxIso === option.value ? undefined : option.value
                        )}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* アクションボタン */}
          <div className="flex gap-2 pt-4 mt-2.5">
            <Button
              variant="outline"
              className="flex-1 hover:bg-background hover:text-foreground"
              style={{ border: '1px solid #d1d5db' }}
              onClick={handleClear}
            >
              クリア
            </Button>
            <Button
              className="flex-1"
              onClick={handleApply}
            >
              適用
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
