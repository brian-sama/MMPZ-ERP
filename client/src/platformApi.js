import axios from 'axios';
import API_BASE from './apiConfig';

const platformApiBaseUrl = (import.meta.env.VITE_PLATFORM_API_BASE_URL || '').trim().replace(/\/+$/, '');

export async function fetchSharedPlatformIndicators() {
  if (!platformApiBaseUrl) return null;

  const exchange = await axios.post(`${API_BASE}/auth/platform-session`);
  const token = exchange.data?.token;
  if (typeof token !== 'string' || !token) {
    throw new Error('ERP did not return a shared platform session.');
  }

  const response = await axios.get(`${platformApiBaseUrl}/api/indicators`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}
