import { Response, Request } from "express";
import { db } from "../lib/prisma";
import {
  CreateProjectDTO,
  ProjectQuery,
  UpdateProjectDTO,
} from "../types/project";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

export const getProjects = async (req: Request, res: Response) => {
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
    const query: ProjectQuery = req.query as ProjectQuery;
    const {
      search,
      status,
      ownerId,
      memberId,
      tags,
      priority,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = query;

    const where: any = {
      AND: [
        // Search by name or description

        { ownerId: session.user?.id },
        search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
        // Filter by status
        status ? { status } : {},
        // Filter by member
        memberId
          ? {
              members: {
                some: { userId: memberId },
              },
            }
          : {},
        // Filter by tags
        tags && tags.length > 0
          ? {
              tags: { hasEvery: typeof tags === "string" ? [tags] : tags },
            }
          : {},
        // Filter by priority
        priority ? { priority } : {},
      ],
    };

    const orderBy: any = {
      [sortBy]: sortOrder,
    };

    const projects = await db.project.findMany({
      where,
      orderBy,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        members: {
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
        tasks: true,
      },
    });

    return res.status(200).json({
      message: "Projects fetched successfully",
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Error getting projects:", error);
    res.status(500).json({ message: "Failed to get projects", success: false });
  }
};

export const getProject = async (req: Request, res: Response) => {
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
    const { id } = req.params;

    const project = await db.project.findUnique({
      where: { id: id, ownerId: session.user?.id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        members: {
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
        tasks: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                ownerId: true,
              },
            },
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
        },
      },
    });

    // Transform tasks to include proper project info
    if (project) {
      project.tasks = project.tasks.map((task) => ({
        ...task,
        project: {
          id: project.id,
          name: project.name,
          ownerId: project.ownerId,
        },
        assignedTo:
          task.assignedTo?.map((assignment) => ({
            ...assignment,
            user: {
              id: assignment.user.id,
              name: assignment.user.name,
              image: assignment.user.image,
            },
          })) || [],
      }));
    }

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Project fetched successfully",
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error getting project:", error);
    res.status(500).json({ message: "Failed to get project", success: false });
  }
};

export const createProject = async (req: Request, res: Response) => {
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
    const projectData: CreateProjectDTO = req.body;
    const userId = session.user?.id;

    const project = await db.project.create({
      data: {
        ...projectData,
        status: projectData.status || "NOT_STARTED",
        priority: projectData.priority || "MEDIUM",
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "owner",
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        members: {
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

    return res.status(201).json({
      message: "Project created successfully",
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    res
      .status(500)
      .json({ message: "Failed to create project", success: false });
  }
};

export const updateProject = async (req: Request, res: Response) => {
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
    const { id } = req.params;
    const projectData: UpdateProjectDTO = req.body;
    const userId = session.user?.id;

    const data: UpdateProjectDTO = {
      ...projectData,
      ...(projectData.progress !== undefined && {
        progress: Number(projectData.progress),
      }),
    };

    // Check if user is owner or admin
    const projectMember = await db.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId,
        },
      },
    });

    if (!projectMember || !["owner", "admin"].includes(projectMember.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const project = await db.project.update({
      where: { id },
      data: data,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        members: {
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
        tasks: true,
      },
    });

    return res.status(200).json({
      message: "Project updated successfully",
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res
      .status(500)
      .json({ message: "Failed to update project", success: false });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
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
    const { id } = req.params;
    const userId = session.user?.id;

    // Check if user is owner
    const project = await db.project.findUnique({
      where: { id },
      select: { ownerId: true },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.ownerId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await db.project.delete({
      where: { id },
    });

    return res.status(200).json({
      message: "Project deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res
      .status(500)
      .json({ message: "Failed to delete project", success: false });
  }
};
