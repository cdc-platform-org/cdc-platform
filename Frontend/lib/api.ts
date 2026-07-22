import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true
});

export interface UserPayload {
  name: string;
  email: string;
  password: string;
  role: 'Student' | 'Mentor' | 'SuperAdmin' | 'EnterpriseClient';
}

export interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string; role: string };
}

export interface LessonPayload {
  title: string;
  content: string;
  durationMinutes: number;
  resources?: string[];
}

export interface CoursePayload {
  title: string;
  description: string;
  category: string;
  lessons: LessonPayload[];
  price: number;
  published?: boolean;
}

export interface OrderPayload {
  enterprise: string;
  contactEmail: string;
  courseIds: string[];
  quantity: number;
  totalPrice: number;
  status?: 'Pending' | 'Approved' | 'Processing' | 'Completed' | 'Cancelled';
}

export async function registerUser(payload: UserPayload) {
  const response = await api.post<AuthResponse>('/auth/register', payload);
  return response.data;
}

export async function loginUser(email: string, password: string) {
  const response = await api.post<AuthResponse>('/auth/login', { email, password });
  return response.data;
}

export async function fetchCourses() {
  const response = await api.get<{ data: CoursePayload[] }>('/courses');
  return response.data.data;
}

export async function createCourse(payload: CoursePayload) {
  const response = await api.post<{ data: any }>('/courses', payload);
  return response.data.data;
}

export async function updateCourse(courseId: string, payload: Partial<CoursePayload>) {
  const response = await api.put<{ data: any }>(`/courses/${courseId}`, payload);
  return response.data.data;
}

export async function fetchOrders() {
  const response = await api.get<{ data: any }>('/orders');
  return response.data.data;
}

export async function createOrder(payload: OrderPayload) {
  const response = await api.post<{ data: any }>('/orders', payload);
  return response.data.data;
}

export async function updateOrderStatus(orderId: string, status: OrderPayload['status']) {
  const response = await api.patch<{ data: any }>(`/orders/${orderId}`, { status });
  return response.data.data;
}
