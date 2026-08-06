import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002',
  withCredentials: true,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('pingr_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  async (err: unknown) => {
    const request = (err as { config?: Record<string, any> }).config
    if (
      err !== null &&
      typeof err === 'object' &&
      'response' in err &&
      (err as { response?: { status?: number } }).response?.status === 401 &&
      request && !request._retried && !String(request.url || '').includes('/api/auth/refresh')
    ) {
      request._retried = true
      try {
        const { data } = await api.post('/api/auth/refresh')
        localStorage.setItem('pingr_token', data.token)
        request.headers = request.headers || {}
        request.headers.Authorization = `Bearer ${data.token}`
        return api.request(request)
      } catch (_refreshError) {
        localStorage.removeItem('pingr_token')
        if (!window.location.pathname.startsWith('/login')) window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
