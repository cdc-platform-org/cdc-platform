import { API_BASE_URL } from '../../services/apiClient';

interface SocialLoginButtonsProps {
  lang: 'ka' | 'en';
  // Only meaningful on the register page — passed through the OAuth
  // redirect round-trip (see routes/auth.ts's signOauthState) so a
  // brand-new GitHub/Facebook signup gets the role the student picked
  // instead of always defaulting to Student.
  role?: 'Student' | 'Client';
}

// GitHub/Facebook use the server-side redirect OAuth flow (routes/auth.ts's
// GET /auth/github and /auth/facebook), unlike Google's client-side SDK
// button — these are plain links, not JS-rendered widgets, so a full page
// navigation to the backend is correct here, not a click handler.
export default function SocialLoginButtons({ lang, role }: SocialLoginButtonsProps) {
  const roleQuery = role ? `?role=${role}` : '';

  return (
    <div className="space-y-2.5">
      <a
        href={`${API_BASE_URL}/auth/github${roleQuery}`}
        className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-[#24292f] dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-white no-underline hover:opacity-90 transition-opacity"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.58.1.79-.25.79-.56 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.77.12 3.06.74.8 1.18 1.83 1.18 3.09 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.07.78 2.15 0 1.56-.01 2.81-.01 3.19 0 .31.21.67.8.56A10.98 10.98 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
        </svg>
        {lang === 'ka' ? 'GitHub-ით შესვლა' : 'Continue with GitHub'}
      </a>
      <a
        href={`${API_BASE_URL}/auth/facebook${roleQuery}`}
        className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-[#1877F2] bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white no-underline hover:opacity-90 transition-opacity"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79V24C19.61 23.1 24 18.1 24 12.07Z" />
        </svg>
        {lang === 'ka' ? 'Facebook-ით შესვლა' : 'Continue with Facebook'}
      </a>
    </div>
  );
}
