import { Router, Request, Response } from "express";

import {
  createChat,
  getChats,
  getChatById,
  updateChat,
  updateChatMembers,
  deleteChat,
} from "../controllers/chats";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  await createChat(req, res);
});

router.get("/", async (req: Request, res: Response) => {
  await getChats(req, res);
});

router.get("/:id", async (req: Request, res: Response) => {
  await getChatById(req, res);
});

router.patch(
  "/:id",
  async (
    req: Request<{ id: string }, {}, { name?: string }>,
    res: Response
  ) => {
    await updateChat(req, res);
  }
);

router.patch(
  "/:id/members",
  async (
    req: Request<
      { id: string },
      {},
      {
        addMembers?: string[];
        removeMembers?: string[];
        roleUpdates?: { userId: string; role: "admin" | "member" }[];
      }
    >,
    res: Response
  ) => {
    await updateChatMembers(req, res);
  }
);

router.delete("/:id", async (req: Request, res: Response) => {
  await deleteChat(req, res);
});

export default router;
