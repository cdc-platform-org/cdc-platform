import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import { generateCertificates, TeacherCertificateType } from '@/src/services/educatorHubService';

interface CertificateBuilderProps {
  lang: 'ka' | 'en';
  hasAccess: boolean;
}

// axios error shape only — no blob responseType on this call, same
// extraction pattern as every other Educator Hub module's own
// extractErrorMessage (see educator-hub.tsx).
function extractErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.message ?? fallback;
}

export default function CertificateBuilder({ lang, hasAccess }: CertificateBuilderProps) {
  const { t } = useTranslation('educatorHub');
  const [studentNames, setStudentNames] = useState<string>('');
  const [certificateType, setCertificateType] = useState<TeacherCertificateType>('COURSE_COMPLETION');
  const [customNomination, setCustomNomination] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCertificates, setGeneratedCertificates] = useState<string[]>([]);

  const handleGenerateCertificates = async () => {
    if (!studentNames.trim()) return;
    if (certificateType === 'CUSTOM' && !customNomination.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const names = studentNames
        .split('\n')
        .map((name) => name.trim())
        .filter(Boolean);
      const result = await generateCertificates({
        names,
        certificateType,
        customNomination: certificateType === 'CUSTOM' ? customNomination.trim() : undefined,
        language: lang,
      });
      setGeneratedCertificates(result.certificates);
    } catch (err) {
      // Previously only console.error'd — Generate would silently do
      // nothing visible on failure (the confirmed audit defect). Every
      // other Educator Hub module surfaces a message here; this now does too.
      setError(extractErrorMessage(err, t('genericError')));
      setGeneratedCertificates([]);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-bold mb-2">{t('certificateTypeLabel')}</label>
        <select
          value={certificateType}
          onChange={(e) => setCertificateType(e.target.value as TeacherCertificateType)}
          disabled={!hasAccess}
          className="w-full px-3 py-2 border rounded-lg disabled:opacity-60"
        >
          <option value="WEEKLY_STAR">{t('certificateTypeWeeklyStar')}</option>
          <option value="COURSE_COMPLETION">{t('certificateTypeCourseCompletion')}</option>
          <option value="OLYMPIAD_WINNER">{t('certificateTypeOlympiadWinner')}</option>
          <option value="CUSTOM">{t('certificateTypeCustom')}</option>
        </select>
        {certificateType === 'CUSTOM' && (
          <input
            type="text"
            value={customNomination}
            onChange={(e) => setCustomNomination(e.target.value)}
            placeholder={t('customNominationPlaceholder')}
            disabled={!hasAccess}
            className="w-full mt-2 px-3 py-2 border rounded-lg disabled:opacity-60"
          />
        )}
      </div>
      <div className="mb-4">
        <label className="block text-sm font-bold mb-2">{t('studentNamesLabel')}</label>
        <textarea
          value={studentNames}
          onChange={(e) => setStudentNames(e.target.value)}
          placeholder={t('studentNamesPlaceholder')}
          rows={5}
          disabled={!hasAccess}
          className="w-full px-3 py-2 border rounded-lg disabled:opacity-60"
        />
      </div>
      <button
        onClick={handleGenerateCertificates}
        disabled={!hasAccess || generating}
        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {generating ? t('generating') : t('generateCertificates')}
      </button>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-3">{error}</p>}
      {generatedCertificates.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-bold mb-2">{t('generatedCertificatesHeading')}</h3>
          <ul className="list-disc pl-5">
            {generatedCertificates.map((cert, index) => (
              <li key={index}>
                <a href={cert} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  {t('downloadCertificate', { index: index + 1 })}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
