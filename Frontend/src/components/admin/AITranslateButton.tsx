// Shared "AI Auto-Translate" trigger — previously copy-pasted verbatim
// across admin/blog.tsx and admin/studio-cases.tsx (identical markup, same
// purple pill, same loading label). Deliberately does NOT own the actual
// translate call: every admin form's Georgian source shape (and the
// backend endpoint it needs to hit — POST /ai/translate for blog,
// /ai/translate-studio-case for studio cases, /ai/translate-course for
// courses, etc.) differs, so the caller supplies `onClick` and owns its
// own request/response wiring; this component only owns the button's
// look, loading state, and disabled-while-translating behavior.
interface AITranslateButtonProps {
  onClick: () => void | Promise<void>;
  loading: boolean;
  label?: string;
  loadingLabel?: string;
  className?: string;
}

export default function AITranslateButton({
  onClick,
  loading,
  label = '✨ AI ავტო-თარგმნა',
  loadingLabel = 'ითარგმნება…',
  className = '',
}: AITranslateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`mb-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg disabled:opacity-60 ${className}`}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}
