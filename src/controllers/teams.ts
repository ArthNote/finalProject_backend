import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { Request, Response } from "express";
import { db } from "../lib/prisma";
import { TeamDetails, TeamRole } from "../types/team";
import { uploadToCloudinary } from "../lib/cloudinary";

export async function getTeam(req: Request, res: Response) {
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
    if (!session.session.activeOrganizationId) {
      return res.status(400).send({
        message: "No active organization found",
        success: false,
      });
    }

    const team = await db.team.findFirst({
      where: {
        organizationId: session.session.activeOrganizationId,
      },
      include: {
        tasks: {
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
            resources: true,
            project: {
              select: {
                id: true,
                name: true,
                ownerId: true,
              },
            },
          },
        },
        activity: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            user: true,
          },
        },
        resources: {
          include: {
            createdBy: {
              select: {
                name: true,
              },
            },
          },
        },
        organization: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      return res.status(404).send({
        message: "Team not found",
        success: false,
      });
    }

    const sub = await db.subscription.findFirst({
      where: {
        referenceId: session.session.activeOrganizationId,
      },
    });

    if (!sub) {
      return res.status(404).send({
        message: "Subscription not found",
        success: false,
      });
    }

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

    const storageUsed = team.resources.reduce((total, resource) => {
      if (resource.type === "file" && resource.size) {
        return total + resource.size;
      }
      return total;
    }, 0);

    const teamData: TeamDetails = {
      id: team.id,
      name: team.name,
      description: "Team workspace",
      memberCount: team.organization.members.length,
      plan: {
        name: "team",
        memberLimit: 10,
        features: ["feature1", "feature2"],
      },
      members: team.organization.members.map((member) => ({
        id: member.id,
        name: member.user.username ?? member.user.name,
        email: member.user.email ?? "",
        role: member.role as TeamRole,
        avatar: member.user.image ?? "",
      })),
      subscription: {
        seats: {
          used: team.organization.members.length,
          total: 10,
        },
        storage: {
          used: storageUsed,
          total: 100,
          unit: "GB",
        },
        plan: {
          name: "team",
          memberLimit: 10,
          features: ["feature1", "feature2"],
          status: sub?.status as "active" | "trialing" | "canceled",
          renewalDate: sub.periodEnd!.toDateString(),
        },
      },
      storage: {
        used: storageUsed,
        total: 100,
      },
      activity: team.activity.map((activity) => ({
        id: activity.id,
        user: {
          name: activity.user.username ?? activity.user.name,
          avatar: activity.user.image ?? null,
        },
        type: activity.type as "task" | "member" | "resource" | "team",
        action: activity.action,
        date: activity.createdAt,
      })),
      tasks: transformTaskAssignees(team.tasks),
      resources: team.resources.map((resource) => {
        return {
          id: resource.id,
          name: resource.name,
          type: resource.type as "file" | "link",
          url: resource.url ?? "",
          size: resource.size ?? 0,
          uploadedBy: resource.createdBy.name,
          createdAt: resource.createdAt,
        };
      }),
    };

    return res.status(200).json({
      message: "Team fetched successfully",
      success: true,
      data: teamData,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching team", success: false });
  }
}

export async function createResource(
  req: Request<
    {},
    {},
    {
      name: string;
      type: "file" | "link";
      url?: string;
      fileData?: any;
      fileName?: string;
      fileSize?: number;
      fileType?: string;
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
    if (!session.session.activeOrganizationId) {
      return res.status(400).send({
        message: "No active organization found",
        success: false,
      });
    }

    const team = await db.team.findFirst({
      where: {
        organizationId: session.session.activeOrganizationId,
      },
    });

    if (!team) {
      return res.status(404).send({
        message: "Team not found",
        success: false,
      });
    }

    const { name, type, url, fileData, fileName, fileSize, fileType } =
      req.body;

    if (!name || !type) {
      return res.status(400).send({
        message: "Name and type are required",
        success: false,
      });
    }

    if (type === "link" && !url) {
      return res.status(400).send({
        message: "URL is required for link type",
        success: false,
      });
    }

    if (type === "link") {
      await db.teamResource.create({
        data: {
          name: name,
          type: type,
          url: url,
          createdById: session.user.id,
          teamId: team.id,
        },
      });
    }

    if (type === "file" && !fileData && !fileName && !fileSize && !fileType) {
      return res.status(400).send({
        message: "Filedata, fileName, and fileSize are required for file type",
        success: false,
      });
    }

    if (type === "file") {
      let fileUrl = "";
      const fileTy = "image";
      try {
        const uploadResult = await uploadToCloudinary.upload(
          fileData,
          "teamFiles-" + team.id,
          fileTy
        );
        fileUrl = uploadResult.secure_url;
      } catch (uploadError: any) {
        console.error("Backend: Cloudinary upload error:", uploadError);
        return res.status(500).json({
          message: "Error uploading file",
          success: false,
          error: uploadError.message,
        });
      }

      await db.teamResource.create({
        data: {
          name: fileName || "File",
          type: type,
          url: fileUrl,
          createdById: session.user.id,
          teamId: team.id,
          size: fileSize,
        },
      });
    }

    await db.teamActivity.create({
      data: {
        userId: session.user.id,
        teamId: team.id,
        type: "resource",
        action: "created",
      },
    });

    return res.status(200).json({
      message: "Resource created successfully",
      success: true,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error creating resource", success: false });
  }
}

export async function deleteResource(
  req: Request<{ id: string }>,
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
    const resource = await db.teamResource.findUnique({
      where: { id: req.params.id },
      include: { team: true },
    });

    if (!resource) {
      return res.status(404).json({
        message: "Resource not found",
        success: false,
      });
    }

    // Check if user has access to the team
    if (resource.team.organizationId !== session.session.activeOrganizationId) {
      return res.status(403).json({
        message: "Unauthorized to delete this resource",
        success: false,
      });
    }

    await db.$transaction(async (tx) => {
      // If it's a file, delete from Cloudinary
      if (resource.type === "file" && resource.url) {
        // Extract public_id from URL
        const urlParts = resource.url.split("/");
        const publicIdWithExt = urlParts[urlParts.length - 1];
        const publicId = `teamFiles-${resource.teamId}/${
          publicIdWithExt.split(".")[0]
        }`;

        await uploadToCloudinary.deleteFile(publicId);
      }

      // Delete from database
      await tx.teamResource.delete({
        where: { id: req.params.id },
      });

      // Create activity log
      await tx.teamActivity.create({
        data: {
          userId: session.user.id,
          teamId: resource.teamId,
          type: "resource",
          action: "deleted",
        },
      });
    });

    return res.status(200).json({
      message: "Resource deleted successfully",
      success: true,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Error deleting resource",
      success: false,
      error: error.message,
    });
  }
}
