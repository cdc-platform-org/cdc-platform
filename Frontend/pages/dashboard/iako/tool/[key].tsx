import { useRouter } from 'next/router';
import ProtectedRoute from '@/src/components/auth/ProtectedRoute';
import IakoMentorPage from '@/src/components/iako/IakoMentorPage';

function IakoDigitalToolContent() {
  const router = useRouter();
  const key = typeof router.query.key === 'string' ? router.query.key : '';
  if (!key) return null;
  return <IakoMentorPage key={key} resource={{ digitalToolKey: key }} backHref="/dashboard/tools" backLabel={router.locale === 'ka' ? 'ჩემი ხელსაწყოები' : 'My Tools'} />;
}

export default function IakoDigitalToolPage() { return <ProtectedRoute><IakoDigitalToolContent /></ProtectedRoute>; }
