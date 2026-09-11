import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  withCredentials: true,
  withXSRFToken: true,
  headers: {
    Accept: 'application/json',
  },
})

export async function ensureCsrfCookie(): Promise<void> {
  await api.get('/sanctum/csrf-cookie')
}

export interface ApiValidationError {
  message: string
  errors?: Record<string, string[]>
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiValidationError>(error)) {
    return error.response?.data?.message ?? fallback
  }

  return fallback
}
