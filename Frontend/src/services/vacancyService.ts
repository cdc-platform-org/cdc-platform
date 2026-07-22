import apiClient from './apiClient';
import { Vacancy, VacancyApplication } from '../types/community';

export interface VacancyFilters {
  skills?: string[];
  employmentType?: string;
  location?: string;
}

export async function getVacancies(filters?: VacancyFilters): Promise<Vacancy[]> {
  const response = await apiClient.get<Vacancy[]>('/vacancies', { params: filters });
  return response.data;
}

export async function getVacancyById(id: string): Promise<Vacancy> {
  const response = await apiClient.get<Vacancy>(`/vacancies/${id}`);
  return response.data;
}

export type PostVacancyPayload = Omit<
  Vacancy,
  'id' | 'postedBy' | 'status' | 'postedAt'
>;

export async function postVacancy(payload: PostVacancyPayload): Promise<Vacancy> {
  const response = await apiClient.post<Vacancy>('/vacancies', payload);
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
  decision: 'accepted' | 'rejected'
): Promise<VacancyApplication> {
  const response = await apiClient.post<VacancyApplication>(
    `/vacancies/${vacancyId}/applications/${applicationId}/review`,
    { decision }
  );
  return response.data;
}
