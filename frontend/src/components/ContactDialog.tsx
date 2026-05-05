import { useTranslation } from "react-i18next";
import { ScrollableInfoDialog } from "./ScrollableInfoDialog";

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
    <ScrollableInfoDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('contact.title')}
      description={t('contact.description')}
    >
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
    </ScrollableInfoDialog>
  );
}
