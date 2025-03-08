import { betterAuth, parseCookies } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./prisma";
import { admin, twoFactor, username } from "better-auth/plugins";
import { sendEmail } from "./resend";
import cookie from "cookie";

import { stripe, Subscription } from "@better-auth/stripe";
import Stripe from "stripe";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
const frontEndUrl = process.env.BETTER_AUTH_URL!;

const getUrl = (token: string, locale: string) => {
  return `${process.env.BACKEND_URL}/api/auth/verify-email?token=${token}&callbackURL=${frontEndUrl}/${locale}/dashboard`;
};

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  appName: "taskflow.",
  trustedOrigins: [
    "https://taskflow-six-kohl.vercel.app",
    "http://localhost:3000",
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url, token }, request) => {
      const u = request?.headers.get("cookie");
      const match = u?.match(/NEXT_LOCALE=([^;]+)/);
      const nextLocale = match ? match[1] : "Not found";

      await sendEmail({
        email: user.email,
        subject:
          nextLocale === "en"
            ? "Reset your password"
            : "Réinitialiser votre mot de passe",
        html:
          nextLocale === "en"
            ? `Click <a href="${url}">here</a> to reset your password.`
            : `Cliquez <a href="${url}">ici</a> pour réinitialiser votre mot de passe.`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }, request) => {
      const u = request?.headers.get("cookie");
      const match = u?.match(/NEXT_LOCALE=([^;]+)/);
      const nextLocale = match ? match[1] : "Not found";
      const urL = getUrl(token, nextLocale);
      await sendEmail({
        email: user.email,
        subject:
          nextLocale === "fr"
            ? "Vérifiez votre adresse e-mail"
            : "Verify your email address",
        html:
          nextLocale === "en"
            ? `Click <a href="${urL}">here</a> to verify your email.`
            : `Cliquez <a href="${urL}">ici</a> pour vérifier votre adresse e-mail.`,
        req: request,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      display: "touch",
      // getUserInfo: async (token) => {
      //   // Implement Google user info fetching logic here
      //   return {
      //     user: {
      //       id: 'google-user-id', // Replace with actual ID from Google
      //       name: 'Google User',  // Replace with actual name
      //       email: 'user@example.com', // Replace with actual email
      //       emailVerified: true,
      //       image
      //     },
      //     data: {} // Additional data if needed
      //   };
      // },
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
      redirectURI: `${frontEndUrl}/en/dashboard`,
      enabled: false,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
      enabled: false,
      redirectURI: `${frontEndUrl}/en/dashboard`,
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID as string,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET as string,
      redirectURI: `${frontEndUrl}/en/dashboard`,
      enabled: false,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: true,
    },
  },

  user: {
    additionalFields: {
      lang: {
        type: "string",
        required: true,
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }, request) => {
        const u = request?.headers.get("cookie");
        const match = u?.match(/NEXT_LOCALE=([^;]+)/);
        const nextLocale = match ? match[1] : "Not found";
        const urL = getUrl(token, nextLocale);
        await sendEmail({
          email: user.email,
          subject:
            nextLocale === "en"
              ? "Delete your account"
              : "Supprimer votre compte",
          html:
            nextLocale === "en"
              ? `Click <a href="${url}">here</a> to delete your account.`
              : `Cliquez <a href="${url}">ici</a> pour supprimer votre compte.`,

          req: request,
        });
      },
    },
    changeEmail: {
      enabled: true,
    },
  },
  advanced: {
    generateId: false,
    session: {
      maxAge: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
  },
  plugins: [
    username(),
    twoFactor(),
    stripe({
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      stripeClient: stripeClient,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        onSubscriptionComplete: async ({
          event,
          subscription,
          stripeSubscription,
          plan,
        }) => {
          console.log("Subscription completed");

          const price = stripeSubscription.items.data[0].plan.amount! / 100;
          const billing = stripeSubscription.items.data[0].plan.interval;

          const data = await db.subscription.update({
            where: {
              id: subscription.id,
            },
            data: {
              billing: billing,
              price: price,
            },
          });

          console.log("updated ", data);
        },
        onSubscriptionUpdate: async ({ event, subscription }) => {
          console.log(`Subscription ${subscription.id} updated`);
        },
        plans: [
          {
            name: "individual",
            priceId: process.env.STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID,
            annualDiscountPriceId:
              process.env.STRIPE_INDIVIDUAL_ANNUAL_PRICE_ID,

            freeTrial: {
              days: 7,
              onTrialStart: async (subscription) => {
                const user = await db.user.findFirst({
                  where: {
                    stripeCustomerId: subscription.stripeCustomerId,
                  },
                });
                if (!user) return;
                await sendEmail({
                  email: user.email!,
                  subject:
                    user.lang === "en" ? "Trial started" : "Essai commencé",
                  html:
                    user.lang === "en"
                      ? `Your trial has started. You can start using the app now.`
                      : `Votre essai a commencé. Vous pouvez commencer à utiliser l'application maintenant.`,
                });
              },
              onTrialEnd: async ({ subscription }, request) => {
                const user = await db.user.findFirst({
                  where: {
                    stripeCustomerId: subscription.stripeCustomerId,
                  },
                });
                if (!user) return;
                await sendEmail({
                  email: user.email!,
                  subject: user.lang === "en" ? "Trial ended" : "Essai terminé",
                  html:
                    user.lang === "en"
                      ? `Your free trial for taskflow has ended. Your subscription has now started, thank you for choosing us!`
                      : "Votre essai gratuit pour taskflow est terminé. Votre abonnement a maintenant commencé, merci de nous avoir choisis!",
                });
              },
              onTrialExpired: async (subscription) => {
                const user = await db.user.findFirst({
                  where: {
                    stripeCustomerId: subscription.stripeCustomerId,
                  },
                });
                if (!user) return;
                await sendEmail({
                  email: user.email!,
                  subject:
                    user.lang === "en" ? "Trial Expired" : "Essai expiré",
                  html:
                    user.lang === "en"
                      ? `Your free trial for taskflow has expired. Upgrade now to continue enjoying the service!`
                      : "Votre essai gratuit pour taskflow a expiré. Mettez à niveau maintenant pour continuer à profiter du service!",
                });
              },
            },
          },
          {
            name: "team",
            priceId: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
            annualDiscountPriceId: process.env.STRIPE_TEAM_ANNUAL_PRICE_ID,
            freeTrial: {
              days: 7,
              onTrialStart: async (subscription) => {
                const user = await db.user.findFirst({
                  where: {
                    stripeCustomerId: subscription.stripeCustomerId,
                  },
                });
                if (!user) return;
                await sendEmail({
                  email: user.email!,
                  subject:
                    user.lang === "en" ? "Trial started" : "Essai commencé",
                  html:
                    user.lang === "en"
                      ? `Your trial has started. You can start using the app now.`
                      : `Votre essai a commencé. Vous pouvez commencer à utiliser l'application maintenant.`,
                });
              },
              onTrialEnd: async ({ subscription }, request) => {
                const user = await db.user.findFirst({
                  where: {
                    stripeCustomerId: subscription.stripeCustomerId,
                  },
                });
                if (!user) return;
                await sendEmail({
                  email: user.email!,
                  subject: user.lang === "en" ? "Trial ended" : "Essai terminé",
                  html:
                    user.lang === "en"
                      ? `Your free trial for taskflow has ended. Your subscription has now started, thank you for choosing us!`
                      : "Votre essai gratuit pour taskflow est terminé. Votre abonnement a maintenant commencé, merci de nous avoir choisis!",
                });
              },
              onTrialExpired: async (subscription) => {
                const user = await db.user.findFirst({
                  where: {
                    stripeCustomerId: subscription.stripeCustomerId,
                  },
                });
                if (!user) return;
                await sendEmail({
                  email: user.email!,
                  subject:
                    user.lang === "en" ? "Trial Expired" : "Essai expiré",
                  html:
                    user.lang === "en"
                      ? `Your free trial for taskflow has expired. Upgrade now to continue enjoying the service!`
                      : "Votre essai gratuit pour taskflow a expiré. Mettez à niveau maintenant pour continuer à profiter du service!",
                });
              },
            },
          },
        ],
      },
    }),
  ],
});

type Session = typeof auth.$Infer.Session;
