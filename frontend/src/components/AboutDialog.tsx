import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Search, LocateFixed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CompassIcon } from "./CompassIcon";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: Readonly<AboutDialogProps>) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '80dvh' }}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t('about.title')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('about.description')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <div className="space-y-6 text-sm leading-relaxed text-foreground mt-4">
          <section>
            <h3 className="font-bold text-base mb-2">{t('about.overview')}</h3>
            <p>
              {t('about.overviewText1')}
            </p>
            <p className="mt-2">
              {t('about.overviewText2')}
            </p>
            <p className="mt-2">
              {t('about.overviewText3')}
            </p>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">{t('about.howToUse')}</h3>
            <ol className="list-decimal list-inside space-y-3">
              <li>
                <span className="font-semibold">{t('about.exploreSpots')}</span>
                <p className="ml-5 mt-1">
                  {t('about.exploreSpotsText')}
                </p>
              </li>
              <li>
                <span className="font-semibold">{t('about.filterPhotos')}</span>
                <p className="ml-5 mt-1">
                  {t('about.filterPhotosText')}
                </p>
              </li>
              <li>
                <span className="font-semibold">{t('about.postPhotos')}</span>
                <p className="ml-5 mt-1">
                  {t('about.postPhotosText')}
                </p>
              </li>
              <li>
                <span className="font-semibold">{t('about.saveFavorites')}</span>
                <p className="ml-5 mt-1">
                  {t('about.saveFavoritesText')}
                </p>
              </li>
              <li>
                <span className="font-semibold">{t('about.enrichProfile')}</span>
                <p className="ml-5 mt-1">
                  {t('about.enrichProfileText')}
                </p>
              </li>
              <li>
                <span className="font-semibold">{t('about.addToHome')}</span>
                <p className="ml-5 mt-1">
                  {t('about.addToHomeText')}
                </p>
              </li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">{t('about.mapControls')}</h3>
            <ul className="space-y-3">
              <li>
                <p>
                  {t('about.mapControlsText')}
                </p>
              </li>
              <li className="flex items-start gap-2">
                <CompassIcon className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">{t('about.compassReset')}</span> — {t('about.compassResetText')}
                </p>
              </li>
              <li className="flex items-start gap-2">
                <Search className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">{t('about.placeSearch')}</span> — {t('about.placeSearchText')}
                </p>
              </li>
              <li className="flex items-start gap-2">
                <LocateFixed className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                  <span className="font-semibold">{t('about.currentLocation')}</span> — {t('about.currentLocationText')}
                </p>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-base mb-2">{t('about.contact')}</h3>
            <p>
              {t('about.contactText')}
            </p>
            <p className="mt-2">
              <a
                href="mailto:support@photlas.jp"
                className="text-blue-600 underline hover:text-blue-800"
              >
                support@photlas.jp
              </a>
            </p>
          </section>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
