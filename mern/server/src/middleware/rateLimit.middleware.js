import rateLimit from "express-rate-limit";

const tooMany = {
  ok: false,
  message: "Too many attempts. Please wait a while and try again."
};

const handler = (req, res) => res.status(429).json(tooMany);

/**
 * Login / register / password-reset throttle.
 * 15 attempts per 15 minutes per IP — enough for a demo, not for brute force.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});

/**
 * Public form throttle (contact / subscribe / enrollment).
 * 10 submissions per 10 minutes per IP.
 */
export const publicFormRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler
});
