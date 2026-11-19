import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 20_000
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const fallback =
      error.code === "ERR_NETWORK"
        ? "Network error. Please check your connection. If you were uploading a file, it may be too large for the server."
        : error.code === "ECONNABORTED" || error.code === "ETIMEDOUT"
          ? "The request timed out. Please try again."
          : error.message || "Request failed";
    const message = error.response?.data?.message || error.response?.data?.msg || fallback;
    const wrapped = new Error(message);
    wrapped.response = error.response;
    wrapped.status = error.response?.status;
    return Promise.reject(wrapped);
  }
);

export default api;
