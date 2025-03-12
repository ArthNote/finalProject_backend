import { Request, Response } from "express";
import { auth, stripeClient } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../lib/prisma";
import { decryptData } from "../lib/crypto";
import { sendEmail } from "../lib/resend";
import Stripe from "stripe";
import exp from "constants";

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

export async function getInvoices(req: Request, res: Response) {
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

    const invoices = await stripeClient.invoices.list({
      customer: session.user.stripeCustomerId!,
      subscription: subscription?.stripeSubscriptionId!,
      limit: 4,
    });

    if (!invoices.data.length) {
      return res.status(200).json({
        message: "No invoices found",
        success: true,
      });
    }

    const formattedInvoices = invoices.data.map((invoice) => {
      return {
        id: invoice.id,
        amount: invoice.amount_due,
        paid: invoice.paid,
        invoicePdf: invoice.invoice_pdf,
        invoiceUrl: invoice.hosted_invoice_url,
        created: new Date(invoice.created * 1000),
      };
    });

    return res.status(200).json({
      data: formattedInvoices,
      success: true,
      message: "Invoices retrieved",
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error retrieving subscription " + error,
      success: false,
    });
  }
}

export async function finalizeInvoice(req: Request, res: Response) {
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
    const id = req.params.id;

    if (!id) {
      return res.status(400).json({
        message: "Invoice ID is required",
        success: false,
      });
    }

    const invoice = await stripeClient.invoices.retrieve(id);

    if (!invoice) {
      return res.status(200).json({
        message: "No invoice found",
        success: true,
      });
    }

    const finalizedInvoice = await stripeClient.invoices.finalizeInvoice(id);

    return res.status(200).json({
      message: "Invoice finalized",
      success: true,
      data: finalizedInvoice.hosted_invoice_url,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error finalizing invoice " + error,
      success: false,
    });
  }
}

export async function getPaymentMethods(req: Request, res: Response) {
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
    const customer = (await stripeClient.customers.retrieve(
      session.user.stripeCustomerId!
    )) as Stripe.Customer;

    const paymentMethod = await stripeClient.customers.retrievePaymentMethod(
      session.user.stripeCustomerId!,
      customer.invoice_settings.default_payment_method as string
    );

    const formatedCard = {
      id: paymentMethod.id,
      month: paymentMethod.card?.exp_month,
      year: paymentMethod.card?.exp_year,
      last4: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
    };

    return res.status(200).json({
      message: "Payment method retrieved",
      success: true,
      data: formatedCard,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error retrieving payment method " + error,
      success: false,
    });
  }
}

export async function changePaymentMethod(req: Request, res: Response) {
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
    const checkoutSession = await stripeClient.billingPortal.sessions.create({
      customer: session.user.stripeCustomerId!,
      locale: session.user.lang as "en" | "fr",

      return_url: "http://localhost:3000/en/dashboard",
    });

    return res.status(200).json({
      message: "Payment method updated",
      success: true,
      link: checkoutSession.url,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error updating payment method " + error,
      success: false,
    });
  }
}
