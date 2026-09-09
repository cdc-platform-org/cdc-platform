import { useRouter } from 'next/router';
import ProtectedRoute from '@/src/components/auth/ProtectedRoute';
import IakoMentorPage from '@/src/components/iako/IakoMentorPage';

function IakoLiveTrainingContent() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  if (!id) return null;
  return <IakoMentorPage resource={{ liveTrainingId: id }} backHref="/dashboard/live-trainings" backLabel="My Live Trainings" guideHref={`/dashboard/live-trainings/${id}/guide`} />;
}

export default function IakoLiveTrainingPage() { return <ProtectedRoute><IakoLiveTrainingContent /></ProtectedRoute>; }
