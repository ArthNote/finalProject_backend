import { Router, Request, Response } from "express";
import {
  changeBillingMode,
  changePlan,
  getSubscription,
  cancelSubscription,
  getInvoices,
  finalizeInvoice,
  getPaymentMethods,
  changePaymentMethod,
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

router.get("/invoices", async (req: Request, res: Response) => {
  await getInvoices(req, res);
});

router.post("/invoices/finalize/:id", async (req: Request, res: Response) => {
  await finalizeInvoice(req, res);
});

router.get("/method", async (req: Request, res: Response) => {
  await getPaymentMethods(req, res);
});

router.get("/changeMethod", async (req: Request, res: Response) => {
  await changePaymentMethod(req, res);
});

export default router;
