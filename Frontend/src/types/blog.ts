interface BlogAuthor {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'Client';
}

export interface BlogPost {
  id: string;
  // Georgian (primary) fields — always set.
  title: string;
  description: string;
  content: string;
  // English twins — optional; public pages fall back to the Georgian fields
  // above when these are null (see pages/blog).
  titleEn: string | null;
  descriptionEn: string | null;
  contentEn: string | null;
  category: string;
  imageUrl: string | null;
  author: BlogAuthor;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}
