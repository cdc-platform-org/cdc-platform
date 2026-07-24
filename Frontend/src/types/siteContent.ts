export interface HomepageStat {
  valueKa: string;
  labelKa: string;
  valueEn: string;
  labelEn: string;
}

export interface HomepageFaqItem {
  questionKa: string;
  answerKa: string;
  questionEn: string;
  answerEn: string;
}

export interface HeksCardConfig {
  // Absolute URL or a server-relative /uploads/... path (see uploadCmsImage).
  // Falls back to the bundled /images/heks-eper.jpg when unset.
  imageUrl?: string;
  objectPosition?: 'top' | 'center' | 'bottom';
  heightPreset?: 'normal' | 'tall';
}

export interface HomepageContent {
  heroTitleKa?: string;
  heroTitleEn?: string;
  heroSubtitleKa?: string;
  heroSubtitleEn?: string;
  stats?: HomepageStat[];
  faq?: HomepageFaqItem[];
  heksCard?: HeksCardConfig;
}
