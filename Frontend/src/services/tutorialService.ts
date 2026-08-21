import apiClient from './apiClient';
import { Tutorial } from '../types/tutorial';

// English falls back to the Georgian (primary) field whenever a tutorial
// has no translation set yet — same convention as blogService.ts.
export function tutorialTitle(tutorial: Tutorial, lang: 'ka' | 'en'): string {
  return (lang === 'en' && tutorial.titleEn) || tutorial.title;
}
export function tutorialDescription(tutorial: Tutorial, lang: 'ka' | 'en'): string {
  return (lang === 'en' && tutorial.descriptionEn) || tutorial.description;
}

export async function getTutorials(category?: string): Promise<Tutorial[]> {
  const response = await apiClient.get<{ data: Tutorial[] }>('/tutorials', {
    params: category ? { category } : undefined,
  });
  return response.data.data;
}

export async function getTutorialById(id: string): Promise<Tutorial> {
  const response = await apiClient.get<{ data: Tutorial }>(`/tutorials/${id}`);
  return response.data.data;
}

// The homepage's "▶ გაიგე როგორ მუშაობს პლატფორმა" button — returns null
// (never a fabricated fallback) until an admin actually marks one tutorial
// as featured in /admin/tutorials, at which point the button appears.
export async function getFeaturedTutorial(): Promise<Tutorial | null> {
  const response = await apiClient.get<{ data: Tutorial[] }>('/tutorials', { params: { featured: 'true' } });
  return response.data.data[0] ?? null;
}

export interface TutorialPayload {
  title: string;
  description: string;
  category: string;
  videoUrl: string;
  titleEn?: string | null;
  descriptionEn?: string | null;
  order?: number;
  published?: boolean;
  isFeatured?: boolean;
}

export async function createTutorial(payload: TutorialPayload): Promise<Tutorial> {
  const response = await apiClient.post<{ data: Tutorial }>('/tutorials', payload);
  return response.data.data;
}

export async function updateTutorial(id: string, payload: Partial<TutorialPayload>): Promise<Tutorial> {
  const response = await apiClient.put<{ data: Tutorial }>(`/tutorials/${id}`, payload);
  return response.data.data;
}

export async function deleteTutorial(id: string): Promise<void> {
  await apiClient.delete(`/tutorials/${id}`);
}

// Turns a YouTube/Vimeo/Loom watch/share URL (whatever an admin naturally
// copies from the browser address bar) into an embeddable player URL for
// the modal's <iframe>. Returns null for anything unrecognized — the
// caller falls back to a plain "open in new tab" link rather than trying
// to embed an arbitrary page in an iframe.
export function getEmbedUrl(videoUrl: string): string | null {
  try {
    const url = new URL(videoUrl);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (url.pathname.startsWith('/embed/')) return url.toString();
      if (url.pathname.startsWith('/shorts/')) {
        const id = url.pathname.split('/')[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      return null;
    }
    if (host === 'vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === 'player.vimeo.com') return url.toString();
    if (host === 'loom.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1];
      if (parts[0] === 'share' && id) return `https://www.loom.com/embed/${id}`;
      if (parts[0] === 'embed' && id) return url.toString();
      return null;
    }
    return null;
  } catch {
    return null;
  }
}
