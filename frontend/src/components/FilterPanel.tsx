import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { CategoryIcon } from "./CategoryIcon";
import { MonthIcons, TimeIcons, WeatherIcons } from "./FilterIcons";
import { PHOTO_CATEGORIES } from "../utils/constants";

export interface FilterConditions {
  categories: string[];
  months: string[];
  timesOfDay: string[];
  weathers: string[];
}

interface FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply?: (conditions: FilterConditions) => void;
}

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

const TIME_OF_DAY = ["朝", "昼", "夕方", "夜"];

const WEATHER = ["晴れ", "曇り", "雨", "雪"];

// アイコンが fill="#000000" でハードコードされているため、選択時に invert が必要なカテゴリ
const CATEGORIES_NEED_INVERT = ["植物", "バイク", "その他"];

// アイコンが fill="#000000" でハードコードされているため、選択時に invert が必要な月（3月以外）
const MONTHS_NEED_INVERT = ["1月", "2月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// アイコンが fill="#000000" でハードコードされているため、選択時に invert が必要な時間帯
const TIMES_NEED_INVERT = ["夕方"];

export function FilterPanel({ open, onOpenChange, onApply }: FilterPanelProps) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedWeather, setSelectedWeather] = useState<string[]>([]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="w-full h-full md:h-auto px-6 py-6 overflow-y-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>フィルター</SheetTitle>
          <SheetDescription>
            被写体種別、時期、時間帯、天候でフィルタリング
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-8 pb-6 mt-5">
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

          {/* アクションボタン */}
          <div className="flex gap-2 pt-4 mt-2.5">
            <Button
              variant="outline"
              className="flex-1 hover:bg-background hover:text-foreground"
              style={{ border: '1px solid #d1d5db' }}
              onClick={() => {
                setSelectedCategories([]);
                setSelectedMonths([]);
                setSelectedTimes([]);
                setSelectedWeather([]);
              }}
            >
              クリア
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (onApply) {
                  onApply({
                    categories: selectedCategories,
                    months: selectedMonths,
                    timesOfDay: selectedTimes,
                    weathers: selectedWeather
                  });
                }
                onOpenChange(false);
              }}
            >
              適用
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}