// Loads the images a design uses through the API proxy (GET
// /api/designs/:id/assets) into same-origin blob: URLs, so Fabric can draw
// and export them without tainting the canvas. One loader per open design.
import { fetchDesignImage } from '../../services/designService';
import type { ImageCache } from './fabricMapping';

export interface ImageLoader {
  cache: ImageCache;
  ensure(sources: string[]): Promise<void>;
  // Registers a just-uploaded local file under its new ref without a refetch.
  put(ref: string, file: Blob): Promise<void>;
  dispose(): void;
}

function loadElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = url;
  });
}

export function createImageLoader(designId: string): ImageLoader {
  const cache: ImageCache = new Map();
  const pending = new Map<string, Promise<void>>();
  const objectUrls: string[] = [];

  async function fromBlob(ref: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    cache.set(ref, await loadElement(url));
  }

  function load(ref: string): Promise<void> {
    if (cache.has(ref)) return Promise.resolve();
    let job = pending.get(ref);
    if (!job) {
      // A failed image is left out of the cache; fabricMapping draws a
      // placeholder box instead so the rest of the design still works.
      job = fetchDesignImage(designId, ref).then((blob) => fromBlob(ref, blob)).catch(() => undefined)
        .finally(() => pending.delete(ref));
      pending.set(ref, job);
    }
    return job;
  }

  return {
    cache,
    ensure: async (sources) => { await Promise.all(sources.map(load)); },
    put: (ref, file) => fromBlob(ref, file),
    dispose: () => objectUrls.forEach((url) => URL.revokeObjectURL(url)),
  };
}
