import { useEffect, useState } from 'react';
import { fetchBookPageImageUrl } from '../../../services/childrensBookService';

// Thumbnail of one generated page illustration. Fetched as an authenticated
// blob (same as the reader) and revoked on change/unmount. Falls back to
// the plain page label while loading, or if the image can't be fetched.
export default function PageThumbnail({ bookId, pageNumber, version, label, alt }: { bookId: string; pageNumber: number; version?: string | null; label: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchBookPageImageUrl(bookId, pageNumber)
      .then((next) => {
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        objectUrl = next;
        setUrl(next);
      })
      .catch(() => setUrl(null));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [bookId, pageNumber, version]);

  if (!url) return <>{label}</>;
  return <img src={url} alt={alt} className="w-full h-full object-cover rounded-lg" />;
}
