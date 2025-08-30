import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
dotenv.config({ silent: true });

const devEnv = process.env.SERVER_ENV === "development";
const maxRequest = {
  global: 100,
  register: 5,
  login: 10,
};
const maxTime = {
  global: 10,
  register: 30,
  login: 10,
};

// Helper buat bikin limiter + logger
const createLimiter = (name, max, windowMinutes, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: devEnv ? max : 99999,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 429, message },
    handler: (req, res, next, options) => {
      // 🔥 Log setiap kena limit
      logger.warn(
        `[RateLimit] ${name} - IP: ${req.ip} - Path: ${req.originalUrl} - Attempts: ${options.limit}`
      );
      res
        .status(options.statusCode)
        .json({ message: options.message, err_code: "RATE_LIMIT_EXCEEDED" });
    },
  });

// Global limiter
export const globalLimiter = createLimiter(
  "Global",
  maxRequest.global,
  maxTime.global,
  "too_many_requests"
);

// Register limiter
export const registerLimiter = createLimiter(
  "Register",
  maxRequest.register,
  maxTime.register,
  "too_many_requests"
);

// Login limiter
export const loginLimiter = createLimiter(
  "Login",
  maxRequest.login,
  maxTime.login,
  "too_many_requests"
);
