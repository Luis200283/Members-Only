import { Router } from "express";
import { body, param, query } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { handleValidation } from "../middleware/validate.js";
import {
  chatReadLimiter,
  chatTypingLimiter,
  chatWriteLimiter,
} from "../middleware/rateLimiters.js";
import {
  createConversation,
  deleteMessage,
  getConversation,
  listConversations,
  listMessages,
  markConversationRead,
  searchUsers,
  sendMessage,
  streamChat,
} from "../controllers/chatController.js";
import {
  createRoom,
  deleteConversation,
  getPresence,
  getReplies,
  joinRoom,
  leaveConversation,
  listLinks,
  listRooms,
  pinMessage,
  searchMessages,
  sendTyping,
  setArchived,
  setMuted,
  toggleReaction,
} from "../controllers/chatFeaturesController.js";
import { ALLOWED_EMOJIS } from "../controllers/chatMessages.js";

const router = Router();

const MAX_INT4 = 2147483647;

const conversationIdRule = param("id")
  .isInt({ min: 1, max: MAX_INT4 })
  .withMessage("Conversación inválida");

const messageIdRule = param("id")
  .isInt({ min: 1, max: MAX_INT4 })
  .withMessage("Mensaje inválido");

router.get("/users", requireAuth, searchUsers);

router.get("/rooms", requireAuth, listRooms);

router.post(
  "/rooms",
  requireAuth,
  chatWriteLimiter,
  body("title")
    .trim()
    .notEmpty()
    .withMessage("El título de la sala es obligatorio")
    .isLength({ max: 80 })
    .withMessage("El título no puede superar 80 caracteres"),
  body("topic")
    .optional({ values: "falsy" })
    .trim()
    .isLength({ max: 160 })
    .withMessage("El tema no puede superar 160 caracteres"),
  body("is_public")
    .isBoolean()
    .withMessage("is_public debe ser booleano")
    .toBoolean(),
  handleValidation,
  createRoom,
);

router.post(
  "/rooms/:id/join",
  requireAuth,
  chatWriteLimiter,
  conversationIdRule,
  handleValidation,
  joinRoom,
);

router.get("/conversations", requireAuth, listConversations);

router.get(
  "/conversations/:id",
  requireAuth,
  conversationIdRule,
  handleValidation,
  getConversation,
);

router.post(
  "/conversations",
  requireAuth,
  chatWriteLimiter,
  body("type")
    .isIn(["direct", "group"])
    .withMessage("Tipo de conversación inválido"),
  body("targetUserId")
    .if(body("type").equals("direct"))
    .isInt({ min: 1 })
    .withMessage("Usuario inválido"),
  body("title")
    .if(body("type").equals("group"))
    .trim()
    .notEmpty()
    .withMessage("El título del grupo es obligatorio")
    .isLength({ max: 80 })
    .withMessage("El título no puede superar 80 caracteres"),
  body("memberIds")
    .if(body("type").equals("group"))
    .isArray({ min: 1 })
    .withMessage("Selecciona al menos un miembro"),
  body("memberIds.*")
    .if(body("type").equals("group"))
    .isInt({ min: 1 })
    .withMessage("Miembro inválido"),
  handleValidation,
  createConversation,
);

router.post(
  "/conversations/:id/leave",
  requireAuth,
  chatWriteLimiter,
  conversationIdRule,
  handleValidation,
  leaveConversation,
);

router.get(
  "/conversations/:id/messages",
  requireAuth,
  conversationIdRule,
  query("before")
    .optional({ values: "falsy" })
    .isInt({ min: 1, max: MAX_INT4 })
    .withMessage("Cursor inválido"),
  handleValidation,
  listMessages,
);

router.post(
  "/conversations/:id/messages",
  requireAuth,
  chatWriteLimiter,
  conversationIdRule,
  body("body")
    .trim()
    .notEmpty()
    .withMessage("El mensaje es obligatorio")
    .isLength({ max: 4000 })
    .withMessage("El mensaje no puede superar 4000 caracteres"),
  body("parentId")
    .optional({ values: "null" })
    .isInt({ min: 1 })
    .withMessage("Mensaje padre inválido"),
  body("quotedId")
    .optional({ values: "null" })
    .isInt({ min: 1 })
    .withMessage("Mensaje citado inválido"),
  handleValidation,
  sendMessage,
);

router.get(
  "/messages/:id/replies",
  requireAuth,
  messageIdRule,
  handleValidation,
  getReplies,
);

router.post(
  "/messages/:id/reactions",
  requireAuth,
  chatWriteLimiter,
  messageIdRule,
  body("emoji")
    .isIn(ALLOWED_EMOJIS)
    .withMessage("Emoji no permitido"),
  handleValidation,
  toggleReaction,
);

router.post(
  "/conversations/:id/pin",
  requireAuth,
  chatWriteLimiter,
  conversationIdRule,
  body("messageId")
    .optional({ values: "null" })
    .isInt({ min: 1, max: MAX_INT4 })
    .withMessage("Mensaje inválido"),
  handleValidation,
  pinMessage,
);

router.post(
  "/conversations/:id/mute",
  requireAuth,
  chatWriteLimiter,
  conversationIdRule,
  body("muted")
    .isBoolean()
    .withMessage("muted debe ser booleano")
    .toBoolean(),
  handleValidation,
  setMuted,
);

router.post(
  "/conversations/:id/archive",
  requireAuth,
  chatWriteLimiter,
  conversationIdRule,
  body("archived")
    .isBoolean()
    .withMessage("archived debe ser booleano")
    .toBoolean(),
  handleValidation,
  setArchived,
);

router.delete(
  "/conversations/:id",
  requireAuth,
  chatWriteLimiter,
  conversationIdRule,
  handleValidation,
  deleteConversation,
);

router.delete(
  "/messages/:id",
  requireAuth,
  chatWriteLimiter,
  messageIdRule,
  handleValidation,
  deleteMessage,
);

router.post(
  "/conversations/:id/typing",
  requireAuth,
  chatTypingLimiter,
  conversationIdRule,
  handleValidation,
  sendTyping,
);

router.get(
  "/conversations/:id/search",
  requireAuth,
  chatReadLimiter,
  conversationIdRule,
  query("q")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("La búsqueda requiere entre 2 y 100 caracteres"),
  handleValidation,
  searchMessages,
);

router.get(
  "/conversations/:id/links",
  requireAuth,
  chatReadLimiter,
  conversationIdRule,
  handleValidation,
  listLinks,
);

router.post(
  "/conversations/:id/read",
  requireAuth,
  chatWriteLimiter,
  conversationIdRule,
  body("messageId")
    .isInt({ min: 1, max: MAX_INT4 })
    .withMessage("Mensaje inválido"),
  handleValidation,
  markConversationRead,
);

router.get("/presence", requireAuth, getPresence);

router.get("/stream", requireAuth, streamChat);

export default router;
