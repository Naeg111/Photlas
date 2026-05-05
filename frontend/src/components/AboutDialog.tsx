import { Map, MapPin, SlidersHorizontal, Heart, UserCircle, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollableInfoDialog } from "./ScrollableInfoDialog";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEATURES = [
  { Icon: Map, titleKey: 'about.feature1Title', textKey: 'about.feature1Text' },
  { Icon: MapPin, titleKey: 'about.feature2Title', textKey: 'about.feature2Text' },
  { Icon: SlidersHorizontal, titleKey: 'about.feature3Title', textKey: 'about.feature3Text' },
  { Icon: Heart, titleKey: 'about.feature4Title', textKey: 'about.feature4Text' },
  { Icon: UserCircle, titleKey: 'about.feature5Title', textKey: 'about.feature5Text' },
  { Icon: Smartphone, titleKey: 'about.feature6Title', textKey: 'about.feature6Text' },
] as const;

/**
 * Issue#114: 「Photlasとは？」ダイアログ（サービス紹介に特化）
 */
export function AboutDialog({ open, onOpenChange }: Readonly<AboutDialogProps>) {
  const { t } = useTranslation();

  return (
    <ScrollableInfoDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('about.title')}
      description={t('about.description')}
    >
      <div className="space-y-6 text-sm leading-relaxed text-foreground mt-4">
        <section>
          <h3 className="font-bold text-base mb-2">{t('about.overview')}</h3>
          <p>{t('about.overviewText1')}</p>
          <p className="mt-2">{t('about.overviewText2')}</p>
          <p className="mt-2">{t('about.overviewText3')}</p>
        </section>

        <section>
          <h3 className="font-bold text-base mb-2">{t('about.features')}</h3>
          <div className="space-y-4">
            {FEATURES.map(({ Icon, titleKey, textKey }) => (
              <div key={titleKey} className="flex items-start gap-3">
                <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold mb-1">{t(titleKey)}</h4>
                  <p>{t(textKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ScrollableInfoDialog>
  );
}
