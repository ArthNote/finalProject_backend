import { Router, Request, Response } from "express";
import {
  createManualTask,
  deleteTask,
  generateTasksWithAi,
  getTasks,
  getTasksByDate,
  getCalendarTasks,
  saveTasksList,
  updateTask,
  updateTaskCompleteStatus,
  updateTaskKanban,
  updateTaskPriority,
  updateTaskStatus,
  updateTaskTimes,
} from "../controllers/tasks";
import { TaskType } from "../types/task";

const router = Router();

router.post("/manual", async (req: Request, res: Response) => {
  await createManualTask(req, res);
});

router.get("/", async (req: Request, res: Response) => {
  await getTasks(req, res);
});

router.post("/ai", async (req: Request, res: Response) => {
  await generateTasksWithAi(req, res);
});

router.post("/all", async (req: Request, res: Response) => {
  await saveTasksList(req, res);
});

router.put(
  "/:id",
  async (req: Request<{ id: string }, {}, TaskType>, res: Response) => {
    await updateTask(req, res);
  }
);

router.put(
  "/priority/:id",
  async (
    req: Request<{ id: string }, {}, { priority: string }>,
    res: Response
  ) => {
    await updateTaskPriority(req, res);
  }
);

router.put(
  "/completed/:id",
  async (req: Request<{ id: string }>, res: Response) => {
    await updateTaskCompleteStatus(req, res);
  }
);

router.put(
  "/status/:id",
  async (
    req: Request<
      { id: string },
      {},
      { status: "unscheduled" | "todo" | "inprogress" | "completed" }
    >,
    res: Response
  ) => {
    await updateTaskStatus(req, res);
  }
);

router.put(
  "/kanban/:id",
  async (
    req: Request<
      { id: string },
      {},
      {
        status: "unscheduled" | "todo" | "inprogress" | "completed";

        destinationIndex: number;
      }
    >,
    res: Response
  ) => {
    await updateTaskKanban(req, res);
  }
);

router.put(
  "/times/:id",
  async (
    req: Request<
      { id: string },
      {},
      { startTime: string; endTime: string; duration: number; date: string }
    >,
    res: Response
  ) => {
    await updateTaskTimes(req, res);
  }
);

router.delete("/:id", async (req: Request, res: Response) => {
  await deleteTask(req, res);
});

router.post("/byDate", async (req: Request, res: Response) => {
  await getTasksByDate(req, res);
});

router.get("/calendar", async (req: Request, res: Response) => {
  await getCalendarTasks(req, res);
});

export default router;
