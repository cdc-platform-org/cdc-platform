export type TeamMemberType = 'MANAGEMENT' | 'TRAINER';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string | null;
  imageUrl: string | null;
  type: TeamMemberType;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
