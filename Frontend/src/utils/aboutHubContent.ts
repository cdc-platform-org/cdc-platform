import rawSeed from '../data/aboutHubSeed.json';
import type { AboutCopy, AboutEntry, AboutHubContent } from '../types/aboutHub';
import { resolveBlogImageUrl } from '../services/blogService';

export const ABOUT_SEED: AboutHubContent = rawSeed;
const isCopy = (value: unknown): value is AboutCopy => !!value && typeof value === 'object' && typeof (value as AboutCopy).ka === 'string' && typeof (value as AboutCopy).en === 'string';
export function isAboutHubContent(value: unknown): value is AboutHubContent {
  if (!value || typeof value !== 'object') return false;
  const c = value as AboutHubContent;
  const entry = (e: AboutEntry) => !!e && ['id', 'category', 'imageUrl', 'startDate', 'endDate', 'metricValue', 'url'].every(key => typeof e[key as keyof AboutEntry] === 'string') && [e.title, e.summary, e.partners, e.metric].every(isCopy) && typeof e.isDemo === 'boolean';
  return c.schemaVersion === 1 && !!c.overview && [c.overview.title, c.overview.intro, c.overview.mission, c.overview.vision].every(isCopy) && typeof c.overview.heroImage === 'string'
    && Array.isArray(c.overview.stats) && c.overview.stats.every(stat => !!stat && typeof stat.value === 'string' && isCopy(stat.label) && typeof stat.isDemo === 'boolean')
    && [c.gallery, c.projects, c.stories, c.partners, c.overview.team, c.overview.accreditations].every(list => Array.isArray(list) && list.every(entry));
}

export function aboutAssetUrl(url: string): string {
  if (!url || !/^(https?:\/\/|\/(?!\/))/.test(url) || url.includes('\\')) return '';
  return url.startsWith('/images/') ? url : resolveBlogImageUrl(url);
}
