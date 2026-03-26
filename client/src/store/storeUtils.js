const API_BASE = import.meta.env.VITE_API_URL || '/api';

const DEBUG = import.meta.env.VITE_DEBUG === 'true';
const log = (...args) => DEBUG && console.log(...args);

const authFetch = async (url, options = {}) => {
  const token = sessionStorage.getItem('authToken');
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  };
  return fetch(url, config);
};

export { API_BASE, DEBUG, log, authFetch };
