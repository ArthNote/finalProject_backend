import { Request, Response } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../lib/prisma";
import { decryptData } from "../lib/crypto";

export async function deleteAccount(req: Request, res: Response) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    return res.status(401).send({
      message: "Unauthorized",
      success: false,
    });
  }

  const id = req.params.id;

  const account = await db.account.findUnique({
    where: {
      id: id,
      userId: session.user.id,
    },
  });

  if (!account) {
    return res.status(404).send({
      message: "Account not found",
      success: false,
    });
  }

  await db.account.delete({
    where: {
      id: id,
    },
  });

  // Changed from 204 to 200 to ensure consistent JSON response
  return res.status(200).json({
    message: "Account deleted",
    success: true,
  });
}

export async function linkCredentials(req: Request, res: Response) {
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
    const decryptedData = decryptData(encryptedData);
    const { username, password } = decryptedData;

    await db.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        username: username,
        displayUsername: username,
      },
    });

    await auth.api.setPassword({
      headers: headers,
      body: {
        newPassword: password,
      },
    });

    return res.status(200).json({
      message: "Credentials updated",
      success: true,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error updating credentials " + error,
      success: false,
    });
  }
}

export async function updateLanguage(req: Request, res: Response) {
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
    const lang = req.query.lang as string;

    if (!lang) {
      return res.status(400).json({
        message: "Language not provided",
        success: false,
      });
    }

    await db.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        lang: lang,
      },
    });

    return res.status(200).json({
      message: "Language updated",
      success: true,
    });
  } catch (error) {
    return res.status(400).json({
      message: "Error updating language " + error,
      success: false,
    });
  }
}


