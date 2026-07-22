interface BlogAuthor {
  id: string;
  name: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'EnterpriseClient';
}

export interface BlogPost {
  id: string;
  title: string;
  description: string;
  category: string;
  content: string;
  imageUrl: string | null;
  author: BlogAuthor;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}
