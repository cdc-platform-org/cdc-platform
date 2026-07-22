import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import RoleGate from '../../src/components/auth/RoleGate';
import PostingForm from '../../src/components/community/PostingForm';

function PostGigPageContent() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-8">Post a Gig</h1>
      <RoleGate
        allowedRoles={['EnterpriseClient', 'SuperAdmin']}
        fallback={
          <p className="text-center text-sm text-gray-500">
            Only Enterprise Clients and Administrators can post gigs.
          </p>
        }
      >
        <PostingForm initialType="gig" />
      </RoleGate>
    </div>
  );
}

export default function PostGigPage() {
  return (
    <ProtectedRoute>
      <PostGigPageContent />
    </ProtectedRoute>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});