export interface AboutCopy { ka: string; en: string }
export type AboutSection = 'overview' | 'gallery' | 'projects' | 'stories' | 'partners';
export type AboutCollection = Exclude<AboutSection, 'overview'>;
export interface AboutEntry {
  id: string;
  title: AboutCopy;
  summary: AboutCopy;
  category: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  partners: AboutCopy;
  metric: AboutCopy;
  metricValue: string;
  url: string;
  isDemo: boolean;
}
export interface AboutHubContent {
  schemaVersion: number;
  overview: {
    title: AboutCopy;
    intro: AboutCopy;
    mission: AboutCopy;
    vision: AboutCopy;
    heroImage: string;
    stats: Array<{ value: string; label: AboutCopy; isDemo: boolean }>;
    accreditations: AboutEntry[];
    team: AboutEntry[];
  };
  gallery: AboutEntry[];
  projects: AboutEntry[];
  stories: AboutEntry[];
  partners: AboutEntry[];
}
