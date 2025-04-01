import rateLimit from "express-rate-limit";

// Create a more strict rate limiter for login attempts
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts per IP within the window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
  handler: (req, res, next, options) => {
    res.status(429).json({
      message: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000 / 60), // Return minutes until reset
    });
  },
});