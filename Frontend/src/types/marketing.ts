export type LaunchKitTargetType = 'DIGITAL_PRODUCT' | 'COURSE';

export interface SocialPost {
  platform: 'facebook' | 'instagram';
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
}

export interface AudienceProfile {
  demographics: string[];
  positioning: string[];
  recommendedChannels: string[];
}

export interface LaunchKit {
  id: string;
  targetType: LaunchKitTargetType;
  productId: string | null;
  courseId: string | null;
  product?: { id: string; title: string } | null;
  course?: { id: string; title: string } | null;
  socialPosts: SocialPost[];
  linkedinPost: string;
  salesEmailSubject: string;
  salesEmailBody: string;
  audienceProfile: AudienceProfile;
  lang: 'ka' | 'en';
  generatedByUser: { id: string; name: string; email: string };
  createdAt: string;
}
