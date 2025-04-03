import { Request, Response } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../lib/prisma";
import { decryptData } from "../lib/crypto";
import { TaskType } from "../types/task";
import { generateTasks } from "../lib/gemini";

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

export async function saveTasksList(
  req: Request<{}, {}, TaskType[]>,
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
    const tasks = req.body;

    if (!tasks) {
      return res.status(400).json({
        message: "No tasks data provided",
        success: false,
      });
    }

    // Create tasks in the database
    await Promise.all(
      tasks.map(async (task) => {
        const { id, parentId, resources, assignedTo, ...taskData } = task;

        // Ensure date fields are properly formatted as Date objects
        const formattedTaskData = {
          ...taskData,
          // Convert date string to Date object or keep null
          date: taskData.date ? new Date(taskData.date) : null,
          // Convert startTime string to Date object or keep null
          startTime: taskData.startTime ? new Date(taskData.startTime) : null,
          // Convert endTime string to Date object or keep null
          endTime: taskData.endTime ? new Date(taskData.endTime) : null,
        };

        await db.task.create({
          data: {
            ...formattedTaskData,
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
      })
    );

    return res.status(200).json({
      message: "Tasks created successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error creating tasks:", error);
    return res.status(400).json({
      message: "Error creating tasks: " + error,
      success: false,
    });
  }
}

export async function generateTasksWithAi(
  req: Request<
    {},
    {},
    {
      prompt: string;
      date: string;
    }
  >,
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
    const { date, prompt } = req.body;

    if (!prompt || !date) {
      return res.status(400).json({
        message: "No prompt or date provided",
        success: false,
      });
    }

    // Generate tasks using AI
    const tasksString = await generateTasks(prompt, date);

    if (!tasksString) {
      return res.status(400).json({
        message: "No tasks generated",
        success: false,
      });
    }

    // Parse the generated tasks string into an array of TaskType objects
    const tasks = JSON.parse(tasksString) as TaskType[];

    if (!Array.isArray(tasks)) {
      return res.status(400).json({
        message: "Invalid tasks format",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Tasks created successfully",
      success: true,
      data: tasks,
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

export async function updateTaskPriority(
  req: Request<{ id: string }, {}, { priority: string }>,
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
    const { priority } = req.body;

    if (!priority) {
      return res.status(400).json({
        message: "No priority value provided",
        success: false,
      });
    }

    // Check if the task exists and belongs to the user or is assigned to the user
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
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Task not found",
        success: false,
      });
    }

    // Update only the priority field
    await db.task.update({
      where: { id },
      data: {
        priority: priority,
      },
    });

    return res.status(200).json({
      message: "Task priority updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating task priority:", error);
    return res.status(500).json({
      message: "Error updating task priority: " + error,
      success: false,
    });
  }
}

export async function updateTaskCompleteStatus(
  req: Request<{ id: string }>,
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

    if (!id) {
      return res.status(400).json({
        message: "No id value provided",
        success: false,
      });
    }

    // Check if the task exists and belongs to the user or is assigned to the user
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
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Task not found",
        success: false,
      });
    }

    // Update only the priority field
    await db.task.update({
      where: { id },
      data: {
        completed: existingTask.completed ? false : true,
      },
    });

    return res.status(200).json({
      message: "Task complete status updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating task complete status:", error);
    return res.status(500).json({
      message: "Error updating task complete status: " + error,
      success: false,
    });
  }
}

export async function updateTaskStatus(
  req: Request<
    { id: string },
    {},
    { status: "unscheduled" | "todo" | "inprogress" | "completed" }
  >,
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
    const status = req.body.status;

    if (!id) {
      return res.status(400).json({
        message: "No id value provided",
        success: false,
      });
    }

    if (!status) {
      return res.status(400).json({
        message: "No status value provided",
        success: false,
      });
    }

    // Check if the task exists and belongs to the user or is assigned to the user
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
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Task not found",
        success: false,
      });
    }

    const isCompleted = status === "completed";
    const isUnscheduled = status === "unscheduled";

    // Update only the priority field
    await db.task.update({
      where: { id },
      data: {
        completed: isCompleted,
        status: isCompleted ? existingTask.status : status,
        scheduled: !isUnscheduled,
        date: isUnscheduled ? null : existingTask.date,
        startTime: isUnscheduled ? null : existingTask.startTime,
        endTime: isUnscheduled ? null : existingTask.endTime,
        duration: isUnscheduled ? null : existingTask.duration,
      },
    });

    return res.status(200).json({
      message: "Task status updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating task status:", error);
    return res.status(500).json({
      message: "Error updating task status: " + error,
      success: false,
    });
  }
}

export async function updateTaskKanban(
  req: Request<
    { id: string },
    {},
    {
      status: "unscheduled" | "todo" | "inprogress" | "completed";
      order: number;
    }
  >,
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
    const { order, status } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "No id value provided",
        success: false,
      });
    }

    if (!status) {
      return res.status(400).json({
        message: "No status value provided",
        success: false,
      });
    }

    // Ensure order is a valid positive number
    const safeOrder = Math.max(1, Number(order) || 1000);
    if (safeOrder <= 0) {
      return res.status(400).json({
        message: "Order must be a positive number",
        success: false,
      });
    }

    // Check if the task exists and belongs to the user or is assigned to the user
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
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Task not found",
        success: false,
      });
    }

    const isCompleted = status === "completed";
    const isUnscheduled = status === "unscheduled";

    // Update task with the safe order value
    await db.task.update({
      where: { id },
      data: {
        completed: isCompleted,
        status: isCompleted ? existingTask.status : status,
        scheduled: !isUnscheduled,
        date: isUnscheduled ? null : existingTask.date,
        startTime: isUnscheduled ? null : existingTask.startTime,
        endTime: isUnscheduled ? null : existingTask.endTime,
        duration: isUnscheduled ? null : existingTask.duration,
        order: safeOrder,
      },
    });

    return res.status(200).json({
      message: "Task status updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating task status:", error);
    return res.status(500).json({
      message: "Error updating task status: " + error,
      success: false,
    });
  }
}

export async function getTasksByDate(
  req: Request<{}, {}, { date: string }>,
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
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        message: "Date parameter is required",
        success: false,
      });
    }

    // Create date objects for the start and end of the requested day
    const requestedDate = new Date(date as string);
    requestedDate.setHours(0, 0, 0, 0); // Start of day

    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(23, 59, 59, 999); // End of day

    // Query for scheduled tasks on the specified date
    const tasks = await db.task.findMany({
      where: {
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
        scheduled: true,
        date: {
          gte: requestedDate,
          lte: endOfDay,
        },
      },
      orderBy: [{ startTime: "asc" }, { priority: "desc" }],
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
    });

    // Transform user data to match our AssignedUser interface
    const transformedTasks = tasks.map((task) => ({
      ...task,
      assignedTo:
        task.assignedTo?.map((assignment: any) => ({
          id: assignment.user.id,
          name: assignment.user.name,
          profilePic: assignment.user.image,
        })) || [],
    }));

    return res.status(200).json({
      message: "Tasks fetched successfully",
      tasks: transformedTasks,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching tasks by date:", error);
    return res.status(500).json({
      message: "Error fetching tasks by date: " + error,
      success: false,
    });
  }
}

export async function updateTaskTimes(
  req: Request<
    { id: string },
    {},
    { startTime: string; endTime: string; duration: number; date: string }
  >,
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
    const { startTime, endTime, duration, date } = req.body;

    if (!id) {
      return res.status(400).json({
        message: "No task id provided",
        success: false,
      });
    }

    if (!startTime || !endTime || !duration) {
      return res.status(400).json({
        message: "Missing required time parameters",
        success: false,
      });
    }

    const existingTask = await db.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return res.status(404).json({
        message: "Task not found",
        success: false,
      });
    }

    // Update task with new time values
    await db.task.update({
      where: { id },
      data: {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        duration,
        date: new Date(date),
        scheduled: true, // Ensure the task is marked as scheduled
      },
    });

    return res.status(200).json({
      message: "Task times updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating task times:", error);
    return res.status(500).json({
      message: "Error updating task times: " + error,
      success: false,
    });
  }
}

export async function getCalendarTasks(req: Request, res: Response) {
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
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        message: "Start and end dates are required",
        success: false,
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    end.setHours(23, 59, 59, 999); // Include the entire end date

    const tasks = await db.task.findMany({
      where: {
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
        scheduled: true,
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
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
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    const transformedTasks = tasks.map((task) => ({
      ...task,
      assignedTo:
        task.assignedTo?.map((assignment) => ({
          id: assignment.user.id,
          name: assignment.user.name,
          profilePic: assignment.user.image,
        })) || [],
    }));

    return res.status(200).json({
      tasks: transformedTasks,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching calendar tasks:", error);
    return res.status(500).json({
      message: "Error fetching calendar tasks: " + error,
      success: false,
    });
  }
}
