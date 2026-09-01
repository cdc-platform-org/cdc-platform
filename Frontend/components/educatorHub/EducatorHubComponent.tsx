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
    </div>
  );
};

export default EducatorHubComponent;
