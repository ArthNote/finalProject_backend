import { Request, Response } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../lib/prisma";
import { decryptData } from "../lib/crypto";
import { TaskType } from "../types/task";

export async function createManualTask(
  req: Request<{}, {}, TaskType>,
  res: Response
) {
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
    const task = req.body;

    if (!task) {
      return res.status(400).json({
        message: "No task data provided",
        success: false,
      });
    }
    const { id, parentId, resources, assignedTo, ...taskData } = task;

    await db.task.create({
      data: {
        ...taskData,
        ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
        ...(assignedTo && assignedTo.length > 0
          ? {
              assignedTo: {
                create: assignedTo.map((userId) => ({
                  user: { connect: { id: userId } },
                })),
              },
            }
          : {}),
        ...(resources && resources.length > 0
          ? {
              resources: {
                create: resources.map(({ id, ...resource }) => ({
                  ...resource,
                })),
              },
            }
          : {}),
      },
    });

    return res.status(200).json({
      message: "Task created successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error creating task:", error);
    return res.status(400).json({
      message: "Error creating task: " + error,
      success: false,
    });
  }
}
