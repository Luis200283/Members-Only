import { Router } from "express";
import { body } from "express-validator";
import { requireAdmin } from "../middleware/auth.js";
import { handleValidation } from "../middleware/validate.js";
import {
  getAdminMessages,
  createAdminMessage,
  deleteUser,
} from "../controllers/adminController.js";

const router = Router();

router.get("/messages", requireAdmin, getAdminMessages);
router.post(
  "/messages",
  requireAdmin,
  body("body").trim().notEmpty().withMessage("El mensaje es obligatorio"),
  handleValidation,
  createAdminMessage,
);
router.delete("/users/:id", requireAdmin, deleteUser);

export default router;
