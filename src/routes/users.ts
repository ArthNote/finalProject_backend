import { Router, Request, Response } from "express";
import {
  deleteAccount,
  linkCredentials,
  updateLanguage,
} from "../controllers/users";

const router = Router();

router.delete("/account/:id", async (req: Request, res: Response) => {
  await deleteAccount(req, res);
});

router.post("/account", async (req: Request, res: Response) => {
  await linkCredentials(req, res);
});

router.put("/language", async (req: Request, res: Response) => {
  await updateLanguage(req, res);
});


export default router;
