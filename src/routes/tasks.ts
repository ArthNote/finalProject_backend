import { Router, Request, Response } from "express";
import {
  createManualTask,
  deleteTask,
  getTasks,
  updateTask,
} from "../controllers/tasks";
import { TaskType } from "../types/task";

const router = Router();

router.post("/manual", async (req: Request, res: Response) => {
  await createManualTask(req, res);
});

router.get("/", async (req: Request, res: Response) => {
  await getTasks(req, res);
});

router.put(
  "/:id",
  async (req: Request<{ id: string }, {}, TaskType>, res: Response) => {
    await updateTask(req, res);
  }
);

router.delete("/:id", async (req: Request, res: Response) => {
  await deleteTask(req, res);
});

export default router;
