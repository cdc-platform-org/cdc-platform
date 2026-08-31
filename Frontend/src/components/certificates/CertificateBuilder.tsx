import React, { useState } from 'react';
import { useTranslation } from 'next-i18next';
import FileDropzone from '@/src/components/shared/FileDropzone';

export default function CertificateBuilder() {
  const { t } = useTranslation('educatorHub');
  const [studentNames, setStudentNames] = useState<string>('');
  const [certificateType, setCertificateType] = useState<'WEEKLY_STAR' | 'COURSE_COMPLETION' | 'OLYMPIAD_WINNER' | 'CUSTOM'>('COURSE_COMPLETION');
  const [customNomination, setCustomNomination] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [generatedCertificates, setGeneratedCertificates] = useState<string[]>([]);

  const handleGenerateCertificates = async () => {
    if (!studentNames.trim()) return;
    setGenerating(true);
    try {
      const names = studentNames.split('\n').map((name) => name.trim()).filter(Boolean);
      const result = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names, certificateType, customNomination }),
      });
      const data = await result.json();
      setGeneratedCertificates(data.certificates);
    } catch (error) {
      console.error('Failed to generate certificates:', error);
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
          onChange={(e) => setCertificateType(e.target.value as any)}
          className="w-full px-3 py-2 border rounded-lg"
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
            className="w-full mt-2 px-3 py-2 border rounded-lg"
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
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>
      <button
        onClick={handleGenerateCertificates}
        disabled={generating}
        className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {generating ? t('generating') : t('generateCertificates')}
      </button>
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
