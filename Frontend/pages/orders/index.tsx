import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import Link from 'next/link';

function OrdersPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Orders</h1>
        <p className="text-sm text-gray-600 mb-6">This is a stub page for orders. Replace with real content.</p>
        <ul className="space-y-2">
          <li className="p-4 border rounded">Order #1001</li>
          <li className="p-4 border rounded">Order #1002</li>
          <li className="p-4 border rounded">Order #1003</li>
        </ul>
        <div className="mt-6">
          <Link href="/" className="text-indigo-600 hover:underline">Back to home</Link>
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
