import apiClient from './apiClient';

export interface AnalyticsOverview {
  totalRevenue: number;
  totalSalesCount: number;
  activeEnrolledStudents: number;
  monthlySales: { month: string; revenue: number; count: number }[];
  topCourses: { courseId: string; courseTitle: string; revenue: number; salesCount: number }[];
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const response = await apiClient.get<{ data: AnalyticsOverview }>('/admin/analytics/overview');
  return response.data.data;
}
