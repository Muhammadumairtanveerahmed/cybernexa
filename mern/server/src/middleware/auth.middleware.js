import { ApiError } from "../utils/ApiError.js";

/**
 * Verifies the JWT or session and attaches the current user to the request.
 *
 * TODO: implement the verification once the auth module is built.
 * Expected result: req.user = { id, role };
 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }
  next();
}

/**
 * Allows only the listed roles.
 *
 *   router.post("/quizzes", requireAuth, requireRole("teacher"), createQuiz);
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ApiError(403, "You do not have permission to perform this action")
      );
    }
    next();
  };
}
