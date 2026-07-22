import SimpleSiteLayout from '@/src/components/layout/SimpleSiteLayout';
import LegalSections from '@/src/components/layout/LegalSections';
import { privacyPolicy, lastUpdated } from '@/src/data/legalContent';
import { merchantInfo } from '@/src/data/merchantInfo';

const heading = { ka: 'კონფიდენციალურობის პოლიტიკა', en: 'Privacy Policy' };
const updatedLabel = { ka: 'ბოლო განახლება', en: 'Last updated' };

export default function PrivacyPolicyPage() {
  return (
    <SimpleSiteLayout titleKa={heading.ka} titleEn={heading.en}>
      {(lang) => {
        const l = lang === 'GEO' ? 'ka' : 'en';
        return (
          <>
            <h1 className="text-3xl font-black mb-2">{heading[l]}</h1>
            <p className="text-xs text-slate-500 mb-2">
              {updatedLabel[l]}: {lastUpdated}
            </p>
            <p className="text-xs text-slate-500 mb-10">
              {merchantInfo.orgNameKa} / {merchantInfo.orgNameEn} — {l === 'ka' ? 'ს/კ' : 'ID Code'} {merchantInfo.identificationCode}
            </p>
            <LegalSections sections={privacyPolicy[l]} />
          </>
        );
      }}
    </SimpleSiteLayout>
  );
}
