import api from "./axios.js";

export const authApi = {
  login: (payload) => api.post("/auth/login", payload),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  registerStudent: (payload) => api.post("/auth/register/student", payload),
  registerTeacher: (payload) => api.post("/auth/register/teacher", payload),
  forgotPassword: (payload) => api.post("/auth/forgot-password", payload),
  resetPassword: (payload) => api.post("/auth/reset-password", payload)
};
