import { Router, Request, Response } from "express";
import { createManualTask, getTasks } from "../controllers/tasks";

const router = Router();

router.post("/manual", async (req: Request, res: Response) => {
  await createManualTask(req, res);
});

router.get("/", async (req: Request, res: Response) => {
  await getTasks(req, res);
});

export default router;
