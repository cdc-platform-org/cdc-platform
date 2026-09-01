import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const router = useRouter();

  const handleLanguageChange = (newLang: string) => {
    i18n.changeLanguage(newLang);
    router.replace(router.asPath, undefined, { locale: newLang });
  };

  return (
    <select
      onChange={(e) => handleLanguageChange(e.target.value)}
      value={i18n.language}
    >
      <option value="en">English</option>
      <option value="ka">ქართული</option>
      <option value="az">Azərbaycan</option>
      <option value="hy">Հայերեն</option>
    </select>
  );
};

export default LanguageSwitcher;
