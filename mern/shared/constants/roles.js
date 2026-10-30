export const ROLES = Object.freeze({
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN: "admin"
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const isRole = (value) => ROLE_VALUES.includes(value);
