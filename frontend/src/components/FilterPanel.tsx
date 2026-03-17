import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { CategoryIcon } from "./CategoryIcon";
import { MonthIcons, TimeIcons, WeatherIcons } from "./FilterIcons";
import { PHOTO_CATEGORIES } from "../utils/constants";
import { ChevronDown, ChevronUp } from "lucide-react";

// Issue#63: maxAgeYears → maxAgeDays に変更
export interface FilterConditions {
  categories: string[];
  months: string[];
  timesOfDay: string[];
  weathers: string[];
  deviceType?: string;
  maxAgeDays?: number;
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

// Issue#63: 上級者向けフィルターの選択肢（機材種別・焦点距離・ISO感度のみ）
const DEVICE_TYPE_OPTIONS = [
  { label: "一眼レフ", value: "SLR" },
  { label: "ミラーレス", value: "MIRRORLESS" },
  { label: "コンパクトデジカメ", value: "COMPACT" },
  { label: "スマートフォン", value: "SMARTPHONE" },
  { label: "フィルム", value: "FILM" },
  { label: "その他", value: "OTHER" },
] as const;

// Issue#63: 撮影日からの経過期間（通常フィルターに移動、3ヶ月以内追加）
const FRESHNESS_OPTIONS = [
  { label: "1週間以内", value: 7 },
  { label: "1ヶ月以内", value: 30 },
  { label: "3ヶ月以内", value: 90 },
  { label: "1年以内", value: 365 },
  { label: "3年以内", value: 1095 },
] as const;

// Issue#63: 写真の向き（通常フィルターに移動、名称変更）
const ASPECT_RATIO_OPTIONS = [
  { label: "横向き", value: "HORIZONTAL" },
  { label: "縦向き", value: "VERTICAL" },
  { label: "正方形", value: "SQUARE" },
] as const;

const FOCAL_LENGTH_OPTIONS = [
  { label: "広角（24mm未満）", value: "WIDE" },
  { label: "標準（24-70mm）", value: "STANDARD" },
  { label: "望遠（70-300mm）", value: "TELEPHOTO" },
  { label: "超望遠（301mm以上）", value: "SUPER_TELEPHOTO" },
] as const;

// Issue#63: ISO感度を4段階に拡張
const ISO_OPTIONS = [
  { label: "ISO 400以下", value: 400 },
  { label: "ISO 1600以下", value: 1600 },
  { label: "ISO 6400以下", value: 6400 },
  { label: "ISO 12800以下", value: 12800 },
] as const;

export function FilterPanel({ open, onOpenChange, onApply }: FilterPanelProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedWeather, setSelectedWeather] = useState<string[]>([]);

  // Issue#63: 通常フィルターに移動した項目
  const [selectedMaxAgeDays, setSelectedMaxAgeDays] = useState<number | undefined>(undefined);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | undefined>(undefined);

  // 上級者向けフィルターの状態
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<string | undefined>(undefined);
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
    setSelectedMaxAgeDays(undefined);
    setSelectedAspectRatio(undefined);
    setSelectedDeviceType(undefined);
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
        maxAgeDays: selectedMaxAgeDays,
        aspectRatio: selectedAspectRatio,
        deviceType: selectedDeviceType,
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
            ジャンル、時期、時間帯、天候でフィルタリング
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-[30px] pb-6 mt-[40px]">
          {/* Issue#63: 写真のジャンル */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">写真のジャンル</p>
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

          {/* Issue#63: 撮影日からの経過期間（通常フィルターに移動） */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">撮影日からの経過期間</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {FRESHNESS_OPTIONS.map((option) => (
                <Button
                  key={option.label}
                  variant={selectedMaxAgeDays === option.value ? "default" : "outline"}
                  className={`text-sm ${selectedMaxAgeDays === option.value ? "hover:bg-primary" : "hover:bg-background hover:text-foreground"}`}
                  style={{ border: '1px solid #d1d5db' }}
                  onClick={() => setSelectedMaxAgeDays(
                    selectedMaxAgeDays === option.value ? undefined : option.value
                  )}
                >
                  {option.label}
                </Button>
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

          {/* 撮影された時間帯 */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">撮影された時間帯</p>
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

          {/* 撮影時の天候 */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">撮影時の天候</p>
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

          {/* Issue#63: 写真の向き（通常フィルターに移動） */}
          <div>
            <p className="text-sm font-medium mb-2 text-muted-foreground">写真の向き</p>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
