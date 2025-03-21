import { Router, Request, Response } from "express";
import { createManualTask } from "../controllers/tasks";

const router = Router();

router.post("/manual", async (req: Request, res: Response) => {
  await createManualTask(req, res);
});


export default router;
