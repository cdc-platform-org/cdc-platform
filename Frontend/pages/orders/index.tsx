import Link from 'next/link';
import { Receipt } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import BackButton from '../../src/components/common/BackButton';

// No backing API for a regular user's own order history yet — the only
// existing `/orders` backend route is an admin-only B2B bulk-course tool
// (Backend/src/routes/orders.ts), unrelated to what this page needs.
// Renders an honest empty state in the VIP glass system rather than
// fake hardcoded "Order #1001"-style rows dressed up to look real.
function OrdersPage() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b0f19] transition-colors">
      <SiteHeader />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">Orders</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-8">Your course, marketplace, and mentorship purchase history.</p>

        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-lg shadow-slate-200/40 dark:shadow-none p-12 text-center transition-colors">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/20">
            <Receipt className="h-7 w-7 text-cyan-500 dark:text-cyan-400" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1.5">No orders yet</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
            Courses, marketplace purchases, and mentorship bookings you complete will show up here.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            Browse Courses
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline">Back to home</Link>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPageWrapper() {
  return (
    <ProtectedRoute>
      <OrdersPage />
    </ProtectedRoute>
  );
}
