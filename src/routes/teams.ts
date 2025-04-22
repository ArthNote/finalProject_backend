import { Router, Request, Response } from "express";
import { getTeam, createResource, deleteResource } from "../controllers/teams";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  await getTeam(req, res);
});

router.post("/resource", async (req: Request, res: Response) => {
  await createResource(req, res);
});

router.delete(
  "/resource/:id",
  async (req: Request<{ id: string }>, res: Response) => {
    await deleteResource(req, res);
  }
);

export default router;
