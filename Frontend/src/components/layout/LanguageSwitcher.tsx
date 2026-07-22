import { useRouter } from 'next/router';

const locales = [
  { code: 'ka', label: 'ქართული' },
  { code: 'en', label: 'English' },
];

export default function LanguageSwitcher() {
  const router = useRouter();
  const { pathname, asPath, query, locale: currentLocale } = router;

  const switchLocale = (nextLocale: string) => {
    router.push({ pathname, query }, asPath, { locale: nextLocale });
  };

  return (
    <div className="flex items-center gap-1 text-sm">
      {locales.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => switchLocale(code)}
          disabled={currentLocale === code}
          className={
            currentLocale === code
              ? 'px-2.5 py-1 rounded-md bg-indigo-600 text-white font-medium cursor-default'
              : 'px-2.5 py-1 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors'
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
