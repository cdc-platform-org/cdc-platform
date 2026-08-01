import apiClient from './apiClient';

export interface KnowledgeSource {
  sourceFilename: string;
  totalChunks: number;
  totalChars: number;
  updatedAt: string;
}

export async function getKnowledgeSources(): Promise<KnowledgeSource[]> {
  const response = await apiClient.get<{ data: KnowledgeSource[] }>('/admin/knowledge/sources');
  return response.data.data;
}

export async function uploadKnowledgeSource(file: File): Promise<{ sourceFilename: string; totalChunks: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{ data: { sourceFilename: string; totalChunks: number } }>(
    '/admin/knowledge/upload',
    formData
  );
  return response.data.data;
}

export async function deleteKnowledgeSource(sourceFilename: string): Promise<void> {
  await apiClient.delete(`/admin/knowledge/sources/${encodeURIComponent(sourceFilename)}`);
}
