import { useRouter } from 'next/router';
import SimpleSiteLayout from '@/src/components/layout/SimpleSiteLayout';
import LegalSections from '@/src/components/layout/LegalSections';
import { termsAndConditions, lastUpdated, FullLocale } from '@/src/data/legalContent';
import { merchantInfo } from '@/src/data/merchantInfo';

const heading = { ka: 'წესები და პირობები', en: 'Terms & Conditions' };
const updatedLabel = { ka: 'ბოლო განახლება', en: 'Last updated' };

// Localized heading/"last updated" label for every site locale — the body
// content itself (termsAndConditions) is fully translated per locale too;
// only the <title>/nav chrome from SimpleSiteLayout stays GEO/ENG (see that
// component's own comment — it's shared with /privacy, /about,
// /refund-policy, which are not yet translated past ka/en).
const pageHeading: Record<FullLocale, string> = {
  ka: 'წესები და პირობები',
  en: 'Terms & Conditions',
  de: 'Allgemeine Geschäftsbedingungen',
  es: 'Términos y Condiciones',
  fr: 'Conditions Générales',
  uk: 'Умови та Положення',
  tr: 'Şartlar ve Koşullar',
  hy: 'Պայմաններ և Դրույթներ',
  az: 'Şərtlər və Qaydalar',
};
const pageUpdatedLabel: Record<FullLocale, string> = {
  ka: 'ბოლო განახლება',
  en: 'Last updated',
  de: 'Zuletzt aktualisiert',
  es: 'Última actualización',
  fr: 'Dernière mise à jour',
  uk: 'Останнє оновлення',
  tr: 'Son güncelleme',
  hy: 'Վերջին թարմացումը',
  az: 'Son yenilənmə',
};
const idCodeLabel: Record<FullLocale, string> = {
  ka: 'ს/კ',
  en: 'ID Code',
  de: 'ID-Nr.',
  es: 'Cód. de ID',
  fr: 'N° d\'identification',
  uk: 'Ідент. код',
  tr: 'Kimlik Kodu',
  hy: 'ID Կոդ',
  az: 'ID Kodu',
};

function isFullLocale(locale: string | undefined): locale is FullLocale {
  return !!locale && locale in pageHeading;
}

export default function TermsPage() {
  const router = useRouter();
  const locale: FullLocale = isFullLocale(router.locale) ? router.locale : 'ka';

  return (
    <SimpleSiteLayout titleKa={heading.ka} titleEn={heading.en}>
      {() => (
        <>
          <h1 className="text-3xl font-black mb-2">{pageHeading[locale]}</h1>
          <p className="text-xs text-slate-500 mb-2">
            {pageUpdatedLabel[locale]}: {lastUpdated}
          </p>
          <p className="text-xs text-slate-500 mb-10">
            {merchantInfo.orgNameKa} / {merchantInfo.orgNameEn} — {idCodeLabel[locale]} {merchantInfo.identificationCode}
          </p>
          <LegalSections sections={termsAndConditions[locale]} />
        </>
      )}
    </SimpleSiteLayout>
  );
}
