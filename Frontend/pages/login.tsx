import { GetServerSideProps } from 'next';

// Alias for the canonical /auth/login page — this page used to be a dead,
// unwired form (no onSubmit, no backend call) that nothing in the codebase
// actually linked to. Kept as a pure redirect rather than a second
// implementation so there is only one place that renders the login UI and
// talks to the backend (pages/auth/login.tsx, GuestRoute + useAuth().login,
// same calls AuthModal.tsx makes). Forwards every query param (in
// particular ?redirect=, the return-destination convention ProtectedRoute /
// GuestRoute / AuthModal already share) so a bookmark or old link to /login
// still lands the visitor back where they meant to go — same pattern as
// pages/verify-certificate/[id].tsx's redirect to /verify/[code].
export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (typeof value === 'string') params.set(key, value);
  });
  const qs = params.toString();
  return {
    redirect: { destination: `/auth/login${qs ? `?${qs}` : ''}`, permanent: false },
  };
};

export default function LoginRedirect() {
  return null;
}
