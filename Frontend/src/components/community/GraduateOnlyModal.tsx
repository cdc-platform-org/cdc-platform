import Link from 'next/link';

interface GraduateOnlyModalProps {
  onClose: () => void;
}

export default function GraduateOnlyModal({ onClose }: GraduateOnlyModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <div className="text-4xl mb-3">🎓</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">CDC Verified Graduates Only</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          შეკვეთების აღება ხელმისაწვდომია მხოლოდ CDC-ის სერტიფიცირებული კურსდამთავრებულებისთვის.
        </p>
        <p className="text-xs text-gray-400 mt-2 leading-relaxed">
          Taking on paid work is only available to verified CDC graduates.
        </p>

        <div className="flex flex-col gap-2 mt-6">
          <Link
            href="/courses"
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 no-underline"
          >
            გაეცანით CDC-ის კურსებს
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
