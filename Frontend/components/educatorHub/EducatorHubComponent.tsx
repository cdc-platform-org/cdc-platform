import { useTranslation } from 'next-i18next';
import { useEffect } from 'react';

const EducatorHubComponent = () => {
  const { t, i18n } = useTranslation('educatorHub');

  useEffect(() => {
    const handleLanguageChange = () => {
      // Trigger reactivity for language changes
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);

  return (
    <div>
      <h1>{t('pageTitle')}</h1>
      {/* Other components */}
      <p className="text-sm text-gray-500 mt-4">
        {t('disclaimer', 'Disclaimer: Please review AI-generated questions for accuracy before using them in assessments.')}
      </p>
    </div>
  );
};

export default EducatorHubComponent;
