export type TeamMemberType = 'MANAGEMENT' | 'TRAINER';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  // Optional English twins — falls back to the Georgian field when unset,
  // same convention as User.mentorTitleEn/bioEn.
  nameEn: string | null;
  roleEn: string | null;
  bioEn: string | null;
  imageUrl: string | null;
  type: TeamMemberType;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
