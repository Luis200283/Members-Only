import { rateLimit } from "express-rate-limit";
import env from "../config/env.js";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  skip: () => env.isTest,
  message: { error: "Demasiadas solicitudes, intenta más tarde" },
});

export const chatWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  skip: () => env.isTest,
  message: { error: "Demasiadas solicitudes, intenta más tarde" },
});

export const chatReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  skip: () => env.isTest,
  message: { error: "Demasiadas solicitudes, intenta más tarde" },
});

export const chatTypingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyGenerator: (req) => `user:${req.user.id}`,
  skip: () => env.isTest,
  message: { error: "Demasiadas solicitudes, intenta más tarde" },
});
