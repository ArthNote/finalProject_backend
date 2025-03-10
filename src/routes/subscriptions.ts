import { Router, Request, Response } from "express";
import {
  changeBillingMode,
  changePlan,
  getSubscription,
  cancelSubscription
} from "../controllers/subscriptions";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  await getSubscription(req, res);
});

router.put("/plan", async (req: Request, res: Response) => {
  await changePlan(req, res);
});

router.put("/billingMode", async (req: Request, res: Response) => {
  await changeBillingMode(req, res);
});

router.get("/cancel", async (req: Request, res: Response) => {
  await cancelSubscription(req, res);
});

export default router;
