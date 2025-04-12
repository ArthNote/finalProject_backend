import { Router } from "express";
import {
  sendMessage,
  getMessages,
  updateMessageStatus,
  searchMessages,
  deleteMessage,
} from "../controllers/messages";

const router = Router();

// Get messages for a chat
router.get("/:chatId", async (req, res) => {
  await getMessages(req, res);
});

// Send a new message
router.post("/:chatId", async (req, res) => {
  await sendMessage(req, res);
});

// Update message status
router.patch("/:messageId/status", async (req, res) => {
  await updateMessageStatus(req, res);
});

// Search messages in a chat
router.get("/:chatId/search", async (req, res) => {
  await searchMessages(req, res);
});

// Delete a message
router.delete("/:messageId", async (req, res) => {
  await deleteMessage(req, res);
});

export default router;
