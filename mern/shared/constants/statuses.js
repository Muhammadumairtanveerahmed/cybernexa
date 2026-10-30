export const USER_STATUS = Object.freeze({
  ACTIVE: "active",
  PENDING: "pending",
  REJECTED: "rejected",
  SUSPENDED: "suspended"
});

export const ENROLLMENT_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed"
});

export const QUIZ_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
  CLOSED: "closed"
});

export const QUIZ_AUDIENCE = Object.freeze({
  ALL: "all",
  COURSE: "course"
});

export const ATTENDANCE_STATUS = Object.freeze({
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
  EXCUSED: "excused"
});
