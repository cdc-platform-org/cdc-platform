import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { resolveLocale } from '../../utils/locale';

interface GraduateOnlyModalProps {
  onClose: () => void;
  // Already resolved to the visitor's locale by the caller (e.g. via
  // useTranslation('proposals').t('signIn.graduatesOnly')) — this modal has
  // no next-i18next namespace of its own, so it can't resolve one itself.
  message?: string;
}

const DICT = {
  ka: {
    defaultMessage: 'შეკვეთების აღება ხელმისაწვდომია მხოლოდ CDC-ის სერტიფიცირებული კურსდამთავრებულებისთვის.',
    heading: 'მხოლოდ CDC-ის ვერიფიცირებული კურსდამთავრებულებისთვის',
    coursesLink: 'გაეცანით CDC-ის კურსებს',
    cancel: 'გაუქმება',
  },
  en: {
    defaultMessage: 'Taking on paid work is only available to verified CDC graduates.',
    heading: 'CDC Verified Graduates Only',
    coursesLink: 'Explore CDC Courses',
    cancel: 'Cancel',
  },
  de: {
    defaultMessage: 'Bezahlte Aufträge sind nur für verifizierte CDC-Absolventen verfügbar.',
    heading: 'Nur für verifizierte CDC-Absolventen',
    coursesLink: 'CDC-Kurse entdecken',
    cancel: 'Abbrechen',
  },
  es: {
    defaultMessage: 'Aceptar trabajos remunerados solo está disponible para graduados verificados de CDC.',
    heading: 'Solo para Graduados Verificados de CDC',
    coursesLink: 'Explorar los Cursos de CDC',
    cancel: 'Cancelar',
  },
  fr: {
    defaultMessage: "Accepter des missions rémunérées n'est possible que pour les diplômés CDC vérifiés.",
    heading: 'Réservé aux diplômés CDC vérifiés',
    coursesLink: 'Découvrir les cours CDC',
    cancel: 'Annuler',
  },
  uk: {
    defaultMessage: 'Виконувати платну роботу можуть лише верифіковані випускники CDC.',
    heading: 'Лише для верифікованих випускників CDC',
    coursesLink: 'Переглянути курси CDC',
    cancel: 'Скасувати',
  },
} as const;

export default function GraduateOnlyModal({ onClose, message }: GraduateOnlyModalProps) {
  const router = useRouter();
  const t = DICT[resolveLocale(router.locale)];
  useEscapeToClose(true, onClose);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <div className="text-4xl mb-3">🎓</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{t.heading}</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          {message ?? t.defaultMessage}
        </p>

        <div className="flex flex-col gap-2 mt-6">
          <Link
            href="/courses"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 no-underline"
          >
            {t.coursesLink}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
