import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { useTranslation } from "react-i18next";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONTACT_EMAIL = "support@photlas.jp";

/**
 * Issue#114: お問い合わせダイアログ
 *
 * 案内文 + mailto リンク（i18n 対応の subject / body 自動入力付き）。
 * シンプル構成（種別選択・返信目安なし）。
 */
export function ContactDialog({ open, onOpenChange }: Readonly<ContactDialogProps>) {
  const { t } = useTranslation();

  const subject = encodeURIComponent(t('contact.mailSubject'));
  const body = encodeURIComponent(t('contact.mailBody'));
  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '80dvh' }}>
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-2xl">{t('contact.title')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('contact.description')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6">
          <div className="space-y-4 text-sm leading-relaxed text-foreground mt-4">
            <p>{t('contact.guideText')}</p>
            <p>
              <a
                href={mailtoHref}
                className="text-blue-600 underline hover:text-blue-800"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
