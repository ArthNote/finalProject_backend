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

export async function getTasks(req: Request, res: Response) {
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
    const {
      search,
      category,
      scheduled,
      priority,
      dateFrom,
      dateTo,
      todoPage = 1,
      todoLimit = 10,
      completedPage = 1,
      completedLimit = 10,
      unscheduledPage = 1,
      unscheduledLimit = 10,
    } = req.query;

    // Base query conditions - using userId directly based on the Prisma schema
    const baseWhere: any = {
      userId: session.user.id,
    };

    // Apply search filter if provided
    if (search) {
      baseWhere.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    // Apply category filter if provided
    if (category && category !== "all") {
      baseWhere.category = category;
    }

    // Apply priority filter if provided
    if (priority && priority !== "all") {
      baseWhere.priority = priority;
    }

    // Get todo tasks - only scheduled tasks when filter is "scheduled" or "all"
    const todoWhere = {
      ...baseWhere,
      completed: false,
      scheduled: true, // Always get scheduled tasks for todo section
    };

    // Add date filter for scheduled tasks
    if (dateFrom || dateTo) {
      todoWhere.AND = todoWhere.AND || [];

      if (dateFrom) {
        todoWhere.AND.push({ date: { gte: new Date(dateFrom as string) } });
      }

      if (dateTo) {
        const endDate = new Date(dateTo as string);
        endDate.setHours(23, 59, 59, 999);
        todoWhere.AND.push({ date: { lte: endDate } });
      }
    }

    // Get completed tasks
    const completedWhere = {
      ...baseWhere,
      completed: true,
    };

    // Add date filter for completed tasks if needed
    if (dateFrom || dateTo) {
      completedWhere.AND = completedWhere.AND || [];

      if (dateFrom) {
        completedWhere.AND.push({
          date: { gte: new Date(dateFrom as string) },
        });
      }

      if (dateTo) {
        const endDate = new Date(dateTo as string);
        endDate.setHours(23, 59, 59, 999);
        completedWhere.AND.push({ date: { lte: endDate } });
      }
    }

    // Get unscheduled tasks - only return if filter is "unscheduled" or "all"
    const unscheduledWhere = {
      ...baseWhere,
      completed: false,
      scheduled: false,
    };

    // Execute queries in parallel
    const [
      todo,
      todoTotal,
      completed,
      completedTotal,
      unscheduled,
      unscheduledTotal,
    ] = await Promise.all([
      // Todo tasks - only get if filter is "all" or "scheduled"
      scheduled !== "unscheduled"
        ? db.task.findMany({
            where: todoWhere,
            skip: (Number(todoPage) - 1) * Number(todoLimit),
            take: Number(todoLimit),
            orderBy: { date: "asc" },
            include: {
              resources: true,
              assignedTo: {
                include: { user: true },
              },
            },
          })
        : Promise.resolve([]),

      // Todo tasks count - only count if filter is "all" or "scheduled"
      scheduled !== "unscheduled"
        ? db.task.count({ where: todoWhere })
        : Promise.resolve(0),

      // Completed tasks
      db.task.findMany({
        where: completedWhere,
        skip: (Number(completedPage) - 1) * Number(completedLimit),
        take: Number(completedLimit),
        orderBy: { date: "desc" },
        include: {
          resources: true,
          assignedTo: {
            include: { user: true },
          },
        },
      }),

      // Completed tasks count
      db.task.count({ where: completedWhere }),

      // Unscheduled tasks - only get if filter is "all" or "unscheduled"
      scheduled !== "scheduled"
        ? db.task.findMany({
            where: unscheduledWhere,
            skip: (Number(unscheduledPage) - 1) * Number(unscheduledLimit),
            take: Number(unscheduledLimit),
            orderBy: { createdAt: "desc" },
            include: {
              resources: true,
              assignedTo: {
                include: { user: true },
              },
            },
          })
        : Promise.resolve([]),

      // Unscheduled tasks count - only count if filter is "all" or "unscheduled"
      scheduled !== "scheduled"
        ? db.task.count({ where: unscheduledWhere })
        : Promise.resolve(0),
    ]);

    return res.status(200).json({
      todo,
      todoTotal,
      completed,
      completedTotal,
      unscheduled,
      unscheduledTotal,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({
      message: "Error fetching tasks: " + error,
      success: false,
    });
  }
}
