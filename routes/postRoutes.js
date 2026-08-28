import { Router } from "express";
import { body } from "express-validator";
import {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
} from "../controllers/postController.js";
import { requireAuth } from "../middleware/auth.js";
import { handleValidation } from "../middleware/validate.js";

const router = Router();

const postRules = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("El título es obligatorio")
    .isLength({ max: 200 })
    .withMessage("El título no puede superar 200 caracteres"),
  body("body").trim().notEmpty().withMessage("El contenido es obligatorio"),
];

router.get("/", getPosts);
router.get("/:id", getPost);
router.post("/", requireAuth, postRules, handleValidation, createPost);
router.put("/:id", requireAuth, postRules, handleValidation, updatePost);
router.delete("/:id", requireAuth, deletePost);

export default router;
