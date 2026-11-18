import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 20_000
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.response?.data?.msg || error.message || "Request failed";
    const wrapped = new Error(message);
    wrapped.response = error.response;
    wrapped.status = error.response?.status;
    return Promise.reject(wrapped);
  }
);

export default api;
