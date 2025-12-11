import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";
import { Button } from "./ui/button";
import { CategoryIcon } from "./CategoryIcon";
import { MonthIcons, TimeIcons, WeatherIcons } from "./FilterIcons";

interface FilterPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

const TIME_OF_DAY = ["朝", "昼", "夕方", "夜"];

const WEATHER = ["晴れ", "曇り", "雨", "雪"];

const CATEGORIES = ["風景", "街並み", "植物", "動物", "自動車", "バイク", "鉄道", "飛行機", "食べ物", "ポートレート", "星空", "その他"];

export function FilterPanel({ open, onOpenChange }: FilterPanelProps) {
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
              {CATEGORIES.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategories.includes(category) ? "default" : "outline"}
                  className="flex items-center gap-2 justify-center"
                  onClick={() =>
                    toggleSelection(category, selectedCategories, setSelectedCategories)
                  }
                >
                  <CategoryIcon category={category} className="w-5 h-5 shrink-0" />
                  <span className="truncate">{category}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* 時期 */}
          <div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {MONTHS.map((month) => {
                const Icon = MonthIcons[month];
                return (
                  <Button
                    key={month}
                    variant={selectedMonths.includes(month) ? "default" : "outline"}
                    className="flex items-center gap-1.5 justify-center px-2"
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
                return (
                  <Button
                    key={time}
                    variant={selectedTimes.includes(time) ? "default" : "outline"}
                    className="flex items-center gap-2 justify-center"
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
                return (
                  <Button
                    key={weather}
                    variant={selectedWeather.includes(weather) ? "default" : "outline"}
                    className="flex items-center gap-2 justify-center"
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
              className="flex-1"
              onClick={() => {
                setSelectedCategories([]);
                setSelectedMonths([]);
                setSelectedTimes([]);
                setSelectedWeather([]);
              }}
            >
              クリア
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              適用
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}