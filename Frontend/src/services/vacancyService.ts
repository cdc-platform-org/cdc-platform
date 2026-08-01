import apiClient from './apiClient';
import { Vacancy, MyVacancy, VacancyApplication } from '../types/community';

export interface VacancyFilters {
  skills?: string[];
  employmentType?: string;
  location?: string;
  category?: string;
}

export async function getVacancies(filters?: VacancyFilters): Promise<Vacancy[]> {
  const response = await apiClient.get<Vacancy[]>('/vacancies', { params: filters });
  return response.data;
}

export async function getVacancyById(id: string): Promise<Vacancy> {
  const response = await apiClient.get<Vacancy>(`/vacancies/${id}`);
  return response.data;
}

// Client Portal — vacancies the caller posted, including drafts.
export async function getMyVacancies(): Promise<MyVacancy[]> {
  const response = await apiClient.get<MyVacancy[]>('/vacancies/mine');
  return response.data;
}

export type VacancyFormPayload = Omit<Vacancy, 'id' | 'postedBy' | 'status' | 'createdAt'> & {
  // Defaults to 'open' on create when omitted — 'draft' saves it without
  // publishing. Ignored by the update path (status changes go through
  // updateVacancyStatus instead, to keep that as an explicit action).
  status?: 'open' | 'draft';
};

export async function postVacancy(payload: VacancyFormPayload): Promise<Vacancy> {
  const response = await apiClient.post<Vacancy>('/vacancies', payload);
  return response.data;
}

export type UpdateVacancyPayload = Partial<Omit<Vacancy, 'id' | 'postedBy' | 'createdAt'>>;

export async function updateVacancy(id: string, payload: UpdateVacancyPayload): Promise<Vacancy> {
  const response = await apiClient.put<Vacancy>(`/vacancies/${id}`, payload);
  return response.data;
}

export async function updateVacancyStatus(id: string, status: 'open' | 'closed' | 'draft'): Promise<Vacancy> {
  const response = await apiClient.put<Vacancy>(`/vacancies/${id}`, { status });
  return response.data;
}

export async function applyToVacancy(
  vacancyId: string,
  payload: { coverNote: string }
): Promise<VacancyApplication> {
  const response = await apiClient.post<VacancyApplication>(
    `/vacancies/${vacancyId}/apply`,
    payload
  );
  return response.data;
}

export async function getVacancyApplications(vacancyId: string): Promise<VacancyApplication[]> {
  const response = await apiClient.get<VacancyApplication[]>(`/vacancies/${vacancyId}/applications`);
  return response.data;
}

export async function reviewVacancyApplication(
  vacancyId: string,
  applicationId: string,
  decision: 'reviewed' | 'accepted' | 'rejected'
): Promise<VacancyApplication> {
  const response = await apiClient.post<VacancyApplication>(
    `/vacancies/${vacancyId}/applications/${applicationId}/review`,
    { decision }
  );
  return response.data;
}
