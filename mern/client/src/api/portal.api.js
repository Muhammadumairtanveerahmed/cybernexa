import api from "./axios.js";

export const portalApi = {
  dashboard: () => api.get("/portal/dashboard"),
  profile: () => api.get("/portal/profile"),
  updateProfile: (data) => api.put("/portal/profile", data),
  uploadAvatar: (data) => api.post("/portal/profile/avatar", data),

  enrollments: () => api.get("/portal/enrollments"),
  fees: () => api.get("/portal/fees"),
  documents: () => api.get("/portal/documents"),
  uploadDocument: (data) => api.post("/portal/documents", data),
  deleteDocument: (id) => api.delete(`/portal/documents/${id}`),

  notices: () => api.get("/portal/notices"),
  createNotice: (data) => api.post("/portal/notices", data),
  deleteNotice: (id) => api.delete(`/portal/notices/${id}`),

  assignments: () => api.get("/portal/assignments"),
  createAssignment: (data) => api.post("/portal/assignments", data),
  updateAssignment: (id, data) => api.put(`/portal/assignments/${id}`, data),
  deleteAssignment: (id) => api.delete(`/portal/assignments/${id}`),
  submitAssignment: (id, data) => api.post(`/portal/assignments/${id}/submit`, data),
  submissions: () => api.get("/portal/submissions"),
  gradeSubmission: (id, data) => api.put(`/portal/submissions/${id}/grade`, data),
  marks: () => api.get("/portal/marks"),

  attendance: () => api.get("/portal/attendance"),
  saveAttendance: (data) => api.post("/portal/attendance/sessions", data),
  deleteAttendance: (id) => api.delete(`/portal/attendance/sessions/${id}`),

  timetable: () => api.get("/portal/timetable"),
  addTimetable: (data) => api.post("/portal/timetable", data),
  deleteTimetable: (id) => api.delete(`/portal/timetable/${id}`),

  materials: () => api.get("/portal/materials"),
  addMaterial: (data) => api.post("/portal/materials", data),
  deleteMaterial: (id) => api.delete(`/portal/materials/${id}`),

  announcements: () => api.get("/portal/announcements"),
  createAnnouncement: (data) => api.post("/portal/announcements", data),
  deleteAnnouncement: (id) => api.delete(`/portal/announcements/${id}`),

  quizzes: () => api.get("/portal/quizzes"),
  quiz: (id) => api.get(`/portal/quizzes/${id}`),
  createQuiz: (data) => api.post("/portal/quizzes", data),
  updateQuiz: (id, data) => api.put(`/portal/quizzes/${id}`, data),
  deleteQuiz: (id) => api.delete(`/portal/quizzes/${id}`),
  startQuiz: (id) => api.post(`/portal/quizzes/${id}/start`),
  submitQuiz: (id, data) => api.post(`/portal/quizzes/${id}/submit`, data),
  recordQuizViolation: (id, data) => api.post(`/portal/quizzes/${id}/violations`, data),

  qbank: () => api.get("/portal/qbank"),
  addQuestion: (data) => api.post("/portal/qbank", data),
  deleteQuestion: (id) => api.delete(`/portal/qbank/${id}`),
  generateQuestions: (data) => api.post("/portal/qbank/ai", data),

  conversations: () => api.get("/portal/conversations"),
  thread: (userId) => api.get(`/portal/messages/${userId}`),
  sendMessage: (data) => api.post("/portal/messages", data),
  markRead: (userId) => api.post(`/portal/messages/${userId}/read`),
  updateMessage: (id, body) => api.put(`/portal/messages/${id}`, { body }),
  deleteMessage: (id) => api.delete(`/portal/messages/${id}`),
  uploadCallRecording: (callKey, data) => api.post(`/portal/calls/${callKey}/recording`, data),

  students: () => api.get("/portal/students"),
  teachers: () => api.get("/portal/teachers"),
  courses: () => api.get("/portal/courses"),
  addCourse: (data) => api.post("/portal/courses", data),
  removeCourse: (id) => api.delete(`/portal/courses/${id}`),

  admin: {
    stats: () => api.get("/admin/stats"),
    students: () => api.get("/admin/students"),
    updateStudent: (id, data) => api.put(`/admin/students/${id}`, data),
    teachers: () => api.get("/admin/teachers"),
    updateTeacher: (id, data) => api.put(`/admin/teachers/${id}`, data),
    enrollments: () => api.get("/admin/enrollments"),
    updateEnrollment: (id, data) => api.put(`/admin/enrollments/${id}`, data),
    recordPayment: (data) => api.post("/admin/payments", data),
    courses: () => api.get("/admin/courses"),
    createCourse: (data) => api.post("/admin/courses", data),
    updateCourse: (id, data) => api.put(`/admin/courses/${id}`, data),
    deleteCourse: (id) => api.delete(`/admin/courses/${id}`),
    logs: () => api.get("/admin/logs"),
    calls: () => api.get("/admin/calls"),
    quizViolations: () => api.get("/admin/quiz-violations"),
    notices: () => api.get("/admin/notices"),
    resets: () => api.get("/admin/resets"),
    createReset: (data) => api.post("/admin/resets", data),
    contactMessages: () => api.get("/admin/contact-messages"),
    subscribers: () => api.get("/admin/subscribers")
  }
};
