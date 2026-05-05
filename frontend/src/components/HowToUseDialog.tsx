import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./ui/accordion";
import { Search, LocateFixed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CompassIcon } from "./CompassIcon";

interface HowToUseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Issue#114: 操作方法ダイアログ
 *
 * 4カテゴリ（基本の使い方・マップの操作・写真の投稿・その他の機能）を
 * アコーディオン形式で表示。type="single" + collapsible で1つだけ開く。
 * 初期状態は全カテゴリ閉じ（defaultValue を指定しない）。
 */
export function HowToUseDialog({ open, onOpenChange }: Readonly<HowToUseDialogProps>) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '80dvh' }}>
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t('howToUse.title')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('howToUse.description')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <Accordion type="single" collapsible className="w-full">
            {/* 基本の使い方 */}
            <AccordionItem value="basics">
              <AccordionTrigger className="text-base font-bold">
                {t('howToUse.basics')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm leading-relaxed">
                  <div>
                    <h4 className="font-semibold mb-1">{t('howToUse.exploreSpots')}</h4>
                    <p>{t('howToUse.exploreSpotsText')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('howToUse.filterPhotos')}</h4>
                    <p>{t('howToUse.filterPhotosText')}</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* マップの操作 */}
            <AccordionItem value="map">
              <AccordionTrigger className="text-base font-bold">
                {t('howToUse.mapControls')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm leading-relaxed">
                  <p>{t('howToUse.mapControlsText')}</p>
                  <div className="flex items-start gap-2">
                    <CompassIcon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">{t('howToUse.compassReset')}</h4>
                      <p>{t('howToUse.compassResetText')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Search className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">{t('howToUse.placeSearch')}</h4>
                      <p>{t('howToUse.placeSearchText')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <LocateFixed className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold">{t('howToUse.currentLocation')}</h4>
                      <p>{t('howToUse.currentLocationText')}</p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 写真の投稿 */}
            <AccordionItem value="post">
              <AccordionTrigger className="text-base font-bold">
                {t('howToUse.post')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm leading-relaxed">
                  <h4 className="font-semibold">{t('howToUse.postPhotos')}</h4>
                  <p>{t('howToUse.postPhotosText1')}</p>
                  <p>{t('howToUse.postPhotosText2')}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* その他の機能 */}
            <AccordionItem value="others">
              <AccordionTrigger className="text-base font-bold">
                {t('howToUse.others')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm leading-relaxed">
                  <div>
                    <h4 className="font-semibold mb-1">{t('howToUse.saveFavorites')}</h4>
                    <p>{t('howToUse.saveFavoritesText')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('howToUse.enrichProfile')}</h4>
                    <p>{t('howToUse.enrichProfileText')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('howToUse.addToHome')}</h4>
                    <p>{t('howToUse.addToHomeText')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('howToUse.languageSwitch')}</h4>
                    <p>{t('howToUse.languageSwitchText')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('howToUse.suggestLocation')}</h4>
                    <p>{t('howToUse.suggestLocationText')}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{t('howToUse.report')}</h4>
                    <p>{t('howToUse.reportText1')}</p>
                    <p className="mt-2">{t('howToUse.reportText2')}</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
}
