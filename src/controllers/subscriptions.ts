import { Request, Response } from "express";
import { auth, stripeClient } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../lib/prisma";
import { decryptData } from "../lib/crypto";
import { sendEmail } from "../lib/resend";
import Stripe from "stripe";

export async function getSubscription(req: Request, res: Response) {
  const headers = fromNodeHeaders(req.headers);
  const session = await auth.api.getSession({
    headers: headers,
  });
  if (!session) {
    return res.status(401).send({
      message: "Unauthorized",
      success: false,
    });
  }

  try {
    const subscription = await db.subscription.findFirst({
      where: {
        stripeCustomerId: session.user.stripeCustomerId,
      },
    });

    if (!subscription) {
      return res.status(200).json({
        message: "No subscription found",
        success: true,
      });
    }

    return res.status(200).json({
      message: "Subscription retrieved",
      success: true,
      data: subscription,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error retrieving subscription " + error,
      success: false,
    });
  }
}

export async function changePlan(req: Request, res: Response) {
  const headers = fromNodeHeaders(req.headers);
  const session = await auth.api.getSession({
    headers: headers,
  });
  if (!session) {
    return res.status(401).send({
      message: "Unauthorized",
      success: false,
    });
  }

  try {
    const dbSub = await db.subscription.findFirst({
      where: {
        stripeCustomerId: session.user.stripeCustomerId,
      },
    });
    if (!dbSub) {
      return res.status(200).json({
        message: "No subscription found",
        success: true,
      });
    }
    const id = dbSub.stripeSubscriptionId!;
    const { encryptedData } = req.body;
    const data = decryptData(encryptedData);
    const { billing, price } = data;

    const sub = await stripeClient.subscriptions.retrieve(id);

    const subItemId = sub.items.data[0].id;

    const prices = await stripeClient.prices.list({
      recurring: {
        interval: billing,
      },
    });

    const planPrice = Number(price) * 100;

    const priceP = prices.data.find((price) => price.unit_amount === planPrice);

    await stripeClient.subscriptions.update(id, {
      items: [
        {
          id: subItemId,
          price: priceP?.id,
        },
      ],
    });

    return res.status(200).json({
      message: "Subscription updated",
      success: true,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error updating subscription " + error,
      success: false,
    });
  }
}

export async function changeBillingMode(req: Request, res: Response) {
  const headers = fromNodeHeaders(req.headers);
  const session = await auth.api.getSession({
    headers: headers,
  });
  if (!session) {
    return res.status(401).send({
      message: "Unauthorized",
      success: false,
    });
  }

  try {
    const { encryptedData } = req.body;
    const data = decryptData(encryptedData);
    const { mode } = data;

    if (!data || !mode || (mode !== "auto" && mode !== "manual")) {
      return res.status(400).json({
        message: "Billing mode is required",
        success: false,
      });
    }

    const sub = await db.subscription.findFirst({
      where: {
        stripeCustomerId: session.user.stripeCustomerId,
      },
    });

    if (!sub) {
      return res.status(200).json({
        message: "No subscription found",
        success: true,
      });
    }

    await stripeClient.subscriptions.update(sub.stripeSubscriptionId!, {
      collection_method:
        mode === "auto" ? "charge_automatically" : "send_invoice",
      days_until_due: mode === "auto" ? undefined : 20,
    });

    await db.subscription.update({
      where: {
        id: sub.id,
      },
      data: {
        autoRenew: mode === "auto",
      },
    });

    sendEmail({
      email: session.user.email,
      subject:
        session.user.lang === "fr"
          ? "Mode de facturation mis à jour"
          : "Billing mode updated",
      html:
        session.user.lang === "fr"
          ? "<p>Votre mode de facturation a été mis à jour avec succès.</p>"
          : "<p>Your billing mode has been successfully updated.</p>",
    });

    return res.status(200).json({
      message: "Subscription updated",
      success: true,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error updating subscription " + error,
      success: false,
    });
  }
}

export async function cancelSubscription(req: Request, res: Response) {
  const headers = fromNodeHeaders(req.headers);
  const session = await auth.api.getSession({
    headers: headers,
  });
  if (!session) {
    return res.status(401).send({
      message: "Unauthorized",
      success: false,
    });
  }

  try {
    const sub = await db.subscription.findFirst({
      where: {
        stripeCustomerId: session.user.stripeCustomerId,
      },
    });

    if (!sub) {
      return res.status(200).json({
        message: "No subscription found",
        success: true,
      });
    }

    const billingSession = await stripeClient.billingPortal.sessions.create({
      customer: session.user.stripeCustomerId!,
      return_url: `http://localhost:3000/${session.user.lang}/settings?tab=myplan`,
      locale: session.user.lang as "en" | "fr",
      flow_data: {
        type: "subscription_cancel",
        subscription_cancel: {
          subscription: sub.stripeSubscriptionId!,
        },
        after_completion: {
          type: "redirect",
          redirect: {
            return_url: `http://localhost:3000/${session.user.lang}/success?tab=cancelSubscription`,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Link generated",
      success: true,
      link: billingSession.url,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error generating link " + error,
      success: false,
    });
  }
}
