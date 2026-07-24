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

export interface HomepageContent {
  heroTitleKa?: string;
  heroTitleEn?: string;
  heroSubtitleKa?: string;
  heroSubtitleEn?: string;
  stats?: HomepageStat[];
  faq?: HomepageFaqItem[];
}
