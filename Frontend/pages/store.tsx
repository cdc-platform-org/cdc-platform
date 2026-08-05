import { useEffect } from 'react';
import { useRouter } from 'next/router';

// /store is now /marketplace — kept as a redirect (rather than removed)
// so any existing bookmarks/external links to /store keep resolving,
// preserving the category query param if one was set.
export default function StoreRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    router.replace({ pathname: '/marketplace', query: router.query });
  }, [router, router.isReady]);

  return null;
}
