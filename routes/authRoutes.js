import { Router } from "express";
import { body } from "express-validator";
import {
  register,
  login,
  logout,
  current,
  becomeAdmin,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { handleValidation } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post(
  "/register",
  authLimiter,
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage("El usuario debe tener entre 3 y 30 caracteres"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("La contraseña debe tener al menos 6 caracteres"),
  handleValidation,
  register,
);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.get("/me", current);
router.post(
  "/admin",
  authLimiter,
  requireAuth,
  body("secret").trim().notEmpty().withMessage("La clave es obligatoria"),
  handleValidation,
  becomeAdmin,
);

export default router;
