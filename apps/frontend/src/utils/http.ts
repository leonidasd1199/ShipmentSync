import axios from 'axios'
import { useAuthStore } from '../stores/auth.store'


const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: false
})

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuth?: boolean
  }
}

http.interceptors.request.use((config) => {
  if (!config.skipAuth) {
    const token = useAuthStore.getState().token
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (token) config.headers = { ...config.headers, Authorization: `Bearer ${token}` } as any
  }
  return config
})

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) useAuthStore.getState().logout()
    return Promise.reject(err)
  }
)

export default http
