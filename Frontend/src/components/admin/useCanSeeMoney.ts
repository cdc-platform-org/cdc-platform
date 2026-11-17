// Money (prices, amounts, payments, escrow, revenue, payouts) is shown in
// the admin panel to SUPER_ADMIN only. The backend already strips money
// fields for every other tier (Backend/src/middleware/moneyVisibility.ts);
// this hook hides the matching columns, KPI cards and form fields so the UI
// never renders an empty "₾ NaN".
import { useAuth } from '../../context/AuthContext';

export function useCanSeeMoney(): boolean {
  const { user } = useAuth();
  return user?.adminRole === 'SUPER_ADMIN';
}
