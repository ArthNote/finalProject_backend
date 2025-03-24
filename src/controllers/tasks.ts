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
        user: { connect: { id: session.user.id } }, // Connect the current user to the task
        ...(parentId ? { parent: { connect: { id: parentId } } } : {}),
        ...(assignedTo && assignedTo.length > 0
          ? {
              assignedTo: {
                create: assignedTo.map((userId) => ({
                  user: {
                    connect: {
                      id: typeof userId === "object" ? userId.id : userId,
                    },
                  },
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
      todoLimit = 2,
      completedPage = 1,
      completedLimit = 2,
      unscheduledPage = 1,
      unscheduledLimit = 2,
      inprogressPage = 1,
      inprogressLimit = 2,
    } = req.query;

    // Base query conditions - include tasks where user is either owner or assigned
    const baseWhere: any = {
      OR: [
        { userId: session.user.id }, // Tasks created by the user
        {
          assignedTo: {
            some: {
              userId: session.user.id, // Tasks assigned to the user
            },
          },
        },
      ],
    };

    // Apply search filter if provided - we'll handle this separately for each section
    let searchCondition = null;
    if (search) {
      searchCondition = {
        OR: [
          { title: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
        ],
      };
    }

    // Apply category filter if provided - we'll handle this separately for each section
    let categoryCondition = null;
    if (category && category !== "all") {
      categoryCondition = { category: category };
    }

    // Apply priority filter if provided - we'll handle this separately for each section
    let priorityCondition = null;
    if (priority && priority !== "all") {
      priorityCondition = { priority: priority };
    }

    // Combine all filters for each section separately

    // 1. TODO TASKS - scheduled and not completed
    const todoWhere: any = {
      ...baseWhere,
      completed: false,
      scheduled: true,
    };

    // Add search, category and priority filters to todo tasks
    if (searchCondition) {
      todoWhere.AND = todoWhere.AND || [];
      todoWhere.AND.push(searchCondition);
    }

    if (categoryCondition) {
      todoWhere.AND = todoWhere.AND || [];
      todoWhere.AND.push(categoryCondition);
    }

    if (priorityCondition) {
      todoWhere.AND = todoWhere.AND || [];
      todoWhere.AND.push(priorityCondition);
    }

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

    // 2. COMPLETED TASKS
    const completedWhere: any = {
      ...baseWhere,
      completed: true,
    };

    // Add search, category and priority filters to completed tasks
    if (searchCondition) {
      completedWhere.AND = completedWhere.AND || [];
      completedWhere.AND.push(searchCondition);
    }

    if (categoryCondition) {
      completedWhere.AND = completedWhere.AND || [];
      completedWhere.AND.push(categoryCondition);
    }

    if (priorityCondition) {
      completedWhere.AND = completedWhere.AND || [];
      completedWhere.AND.push(priorityCondition);
    }

    // Add date filter for completed tasks
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

    // 3. UNSCHEDULED TASKS
    const unscheduledWhere: any = {
      ...baseWhere,
      completed: false,
      scheduled: false,
    };

    // Add search, category and priority filters to unscheduled tasks
    if (searchCondition) {
      unscheduledWhere.AND = unscheduledWhere.AND || [];
      unscheduledWhere.AND.push(searchCondition);
    }

    if (categoryCondition) {
      unscheduledWhere.AND = unscheduledWhere.AND || [];
      unscheduledWhere.AND.push(categoryCondition);
    }

    if (priorityCondition) {
      unscheduledWhere.AND = unscheduledWhere.AND || [];
      unscheduledWhere.AND.push(priorityCondition);
    }

    // For unscheduled tasks, allow null dates but also apply date filters to any that have dates
    if (
      (dateFrom || dateTo) &&
      (scheduled === "all" || scheduled === "unscheduled")
    ) {
      unscheduledWhere.AND = unscheduledWhere.AND || [];

      // For date filters on unscheduled tasks, we want to include tasks with null dates
      // OR tasks with dates matching the filter
      const dateCondition: any = {
        OR: [
          { date: null }, // Always include tasks with null dates for unscheduled section
        ],
      };

      // Build the date range condition for non-null dates
      let dateRangeCondition: any = {};

      if (dateFrom && dateTo) {
        const startDate = new Date(dateFrom as string);
        const endDate = new Date(dateTo as string);
        endDate.setHours(23, 59, 59, 999);

        dateRangeCondition = {
          AND: [{ date: { gte: startDate } }, { date: { lte: endDate } }],
        };

        dateCondition.OR.push(dateRangeCondition);
      } else if (dateFrom) {
        dateCondition.OR.push({ date: { gte: new Date(dateFrom as string) } });
      } else if (dateTo) {
        const endDate = new Date(dateTo as string);
        endDate.setHours(23, 59, 59, 999);
        dateCondition.OR.push({ date: { lte: endDate } });
      }

      unscheduledWhere.AND.push(dateCondition);
    }

    // Add a new section for IN PROGRESS TASKS
    const inprogressWhere: any = {
      ...baseWhere,
      completed: false,
      scheduled: true,
      status: "inprogress",
    };

    // Add search, category and priority filters to in-progress tasks
    if (searchCondition) {
      inprogressWhere.AND = inprogressWhere.AND || [];
      inprogressWhere.AND.push(searchCondition);
    }

    if (categoryCondition) {
      inprogressWhere.AND = inprogressWhere.AND || [];
      inprogressWhere.AND.push(categoryCondition);
    }

    if (priorityCondition) {
      inprogressWhere.AND = inprogressWhere.AND || [];
      inprogressWhere.AND.push(priorityCondition);
    }

    // Add date filter for in-progress tasks
    if (dateFrom || dateTo) {
      inprogressWhere.AND = inprogressWhere.AND || [];

      if (dateFrom) {
        inprogressWhere.AND.push({
          date: { gte: new Date(dateFrom as string) },
        });
      }

      if (dateTo) {
        const endDate = new Date(dateTo as string);
        endDate.setHours(23, 59, 59, 999);
        inprogressWhere.AND.push({ date: { lte: endDate } });
      }
    }

    // Modify todoWhere to exclude in-progress tasks
    todoWhere.AND = todoWhere.AND || [];
    todoWhere.AND.push({
      OR: [{ status: null }, { status: { not: "inprogress" } }],
    });

    // Calculate proper offsets for pagination
    const todoSkip = (Number(todoPage) - 1) * Number(todoLimit);
    const completedSkip = (Number(completedPage) - 1) * Number(completedLimit);
    const unscheduledSkip =
      (Number(unscheduledPage) - 1) * Number(unscheduledLimit);
    const inprogressSkip =
      (Number(inprogressPage) - 1) * Number(inprogressLimit);

    // Execute queries in parallel
    const [
      todoTasks,
      todoTotal,
      completedTasks,
      completedTotal,
      unscheduledTasks,
      unscheduledTotal,
      inprogressTasks,
      inprogressTotal,
    ] = await Promise.all([
      // Todo tasks - only get if filter is "all" or "scheduled"
      scheduled !== "unscheduled"
        ? db.task.findMany({
            where: todoWhere,
            skip: todoSkip,
            take: Number(todoLimit),
            orderBy: { date: "asc" },
            include: {
              resources: true,
              assignedTo: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      image: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),

      // Todo tasks count
      scheduled !== "unscheduled"
        ? db.task.count({ where: todoWhere })
        : Promise.resolve(0),

      // Completed tasks
      db.task.findMany({
        where: completedWhere,
        skip: completedSkip,
        take: Number(completedLimit),
        orderBy: { date: "desc" },
        include: {
          resources: true,
          assignedTo: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
        },
      }),

      // Completed tasks count
      db.task.count({ where: completedWhere }),

      // Unscheduled tasks - only get if filter is "all" or "unscheduled"
      scheduled !== "scheduled"
        ? db.task.findMany({
            where: unscheduledWhere,
            skip: unscheduledSkip,
            take: Number(unscheduledLimit),
            orderBy: { createdAt: "desc" },
            include: {
              resources: true,
              assignedTo: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      image: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),

      // Unscheduled tasks count
      scheduled !== "scheduled"
        ? db.task.count({ where: unscheduledWhere })
        : Promise.resolve(0),

      // In-progress tasks
      scheduled !== "unscheduled"
        ? db.task.findMany({
            where: inprogressWhere,
            skip: inprogressSkip,
            take: Number(inprogressLimit),
            orderBy: { date: "asc" },
            include: {
              resources: true,
              assignedTo: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      image: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),

      // In-progress tasks count
      scheduled !== "unscheduled"
        ? db.task.count({ where: inprogressWhere })
        : Promise.resolve(0),
    ]);

    // Transform user data to match our AssignedUser interface
    const transformTaskAssignees = (tasks: any[]) => {
      return tasks.map((task) => ({
        ...task,
        assignedTo:
          task.assignedTo?.map((assignment: any) => ({
            id: assignment.user.id,
            name: assignment.user.name,
            profilePic: assignment.user.image,
          })) || [],
      }));
    };

    const todo = transformTaskAssignees(todoTasks);
    const completed = transformTaskAssignees(completedTasks);
    const unscheduled = transformTaskAssignees(unscheduledTasks);
    const inprogress = transformTaskAssignees(inprogressTasks);

    return res.status(200).json({
      todo,
      todoTotal,
      completed,
      completedTotal,
      unscheduled,
      unscheduledTotal,
      inprogress,
      inprogressTotal,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({
      message: "Error fetching tasks: " + error,
      success: false,
    });
  }
}

export async function deleteTask(req: Request, res: Response) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    return res.status(401).send({
      message: "Unauthorized",
      success: false,
    });
  }

  try {
    const id = req.params.id;

    const task = await db.task.findUnique({
      where: {
        id: id,
        userId: session.user.id,
      },
    });

    if (!task) {
      return res.status(404).send({
        message: "Task not found",
        success: false,
      });
    }

    await db.task.delete({
      where: {
        id: id,
      },
    });

    return res.status(200).json({
      message: "Task deleted",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting task: " + error,
      success: false,
    });
  }
}

export async function updateTask(
  req: Request<{ id: string }, {}, TaskType>,
  res: Response
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    return res.status(401).send({
      message: "Unauthorized",
      success: false,
    });
  }

  try {
    const id = req.params.id;
    const taskData = req.body;

    if (!taskData) {
      return res.status(400).json({
        message: "No task data provided",
        success: false,
      });
    }

    // Check if the task exists and belongs to the user
    const existingTask = await db.task.findFirst({
      where: {
        id: id,
        OR: [
          { userId: session.user.id },
          {
            assignedTo: {
              some: {
                userId: session.user.id,
              },
            },
          },
        ],
      },
      include: {
        assignedTo: true,
        resources: true,
      },
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Task not found",
        success: false,
      });
    }

    // Extract the fields that need special handling
    const { assignedTo, resources, parentId, ...updateData } = taskData;

    // Prepare the update data
    const updateObject: any = {
      ...updateData,
    };

    // Handle parent task connection/disconnection
    if (parentId !== undefined) {
      if (parentId) {
        updateObject.parent = { connect: { id: parentId } };
      } else {
        // Handle null or empty string parentId - disconnect the relationship
        updateObject.parent = { disconnect: true };
      }
    }

    // Update the task
    await db.task.update({
      where: { id },
      data: updateObject,
    });

    // Handle resources if provided (delete existing and create new ones)
    if (resources) {
      // Delete existing resources
      await db.taskResource.deleteMany({
        where: { taskId: id },
      });

      // Create new resources
      if (resources.length > 0) {
        await db.taskResource.createMany({
          data: resources.map(({ id: resourceId, ...resource }) => ({
            ...resource,
            taskId: id,
          })),
        });
      }
    }

    // Handle assigned users if provided
    if (assignedTo) {
      // Delete existing assignments
      await db.taskAssignment.deleteMany({
        where: { taskId: id },
      });

      // Create new assignments
      if (assignedTo.length > 0) {
        await db.taskAssignment.createMany({
          data: assignedTo.map((user) => ({
            taskId: id,
            userId: typeof user === "object" ? user.id : user,
          })),
        });
      }
    }

    return res.status(200).json({
      message: "Task updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating task:", error);
    return res.status(500).json({
      message: "Error updating task: " + error,
      success: false,
    });
  }
}
