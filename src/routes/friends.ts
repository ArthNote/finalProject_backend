import { Router, Request, Response } from "express";
import {
  getFriends,
  sendFriendRequest,
  respondToFriendRequest,
  deleteFriendship,
  getFriendRequests,
  cancelFriendRequest,
  searchUsers,
} from "../controllers/friends";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  await getFriends(req, res);
});

router.post("/send-request", async (req: Request, res: Response) => {
  await sendFriendRequest(req, res);
});

router.post("/respond", async (req: Request, res: Response) => {
  await respondToFriendRequest(req, res);
});

router.delete("/delete", async (req: Request, res: Response) => {
  await deleteFriendship(req, res);
});

router.get("/requests", async (req: Request, res: Response) => {
  await getFriendRequests(req, res);
});

router.delete("/cancel-request", async (req: Request, res: Response) => {
  await cancelFriendRequest(req, res);
});

router.get("/search", async (req: Request, res: Response) => {
  await searchUsers(req, res);
});

export default router;
