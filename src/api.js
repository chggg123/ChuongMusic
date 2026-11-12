import { API_BASE } from './constants';

export const requestAccountApi = async (path, options = {}) => {
  const { credentials = 'include', headers = {}, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    credentials,
    headers: {
      ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
      'X-Chuong-Request': '1',
      ...headers
    }
  });
  let result;
  try {
    result = await response.json();
  } catch {
    const error = new Error(`Máy chủ trả về phản hồi không hợp lệ (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(result.error || `Yêu cầu thất bại (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
};
