import { Request, Response } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../lib/prisma";

export async function createChat(
  req: Request<
    {},
    {},
    {
      participantIds: string[];
      type: "individual" | "group";
      name?: string;
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

  const { participantIds, type, name } = req.body;

  try {
    // Validate participants
    if (type === "individual" && participantIds.length !== 1) {
      return res.status(400).json({
        message: "Individual chat must have exactly one participant",
        success: false,
      });
    }

    // For individual chats, check if chat already exists
    if (type === "individual") {
      const existingChat = await db.chat.findFirst({
        where: {
          type: "individual",
          participants: {
            every: {
              userId: {
                in: [session.user.id, participantIds[0]],
              },
            },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          messages: {
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  image: true,
                },
              },
            },
          },
        },
      });

      if (existingChat) {
        return res.status(200).json({
          message: "Chat already exists",
          success: true,
          data: existingChat,
        });
      }
    }

    // Create new chat
    const chat = await db.chat.create({
      data: {
        type,
        name: type === "group" ? name : undefined,
        participants: {
          create: [
            { userId: session.user.id, role: "admin" },
            ...participantIds.map((id) => ({
              userId: id,
              role: "member",
            })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                image: true,
              },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      message: "Chat created successfully",
      success: true,
      data: chat,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating chat",
      success: false,
    });
  }
}

export async function getChats(req: Request, res: Response) {
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
    const chats = await db.chat.findMany({
      where: {
        participants: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                image: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                image: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return res.status(200).json({
      message: "Chats fetched successfully",
      success: true,
      data: chats,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching chats",
      success: false,
    });
  }
}

export async function getChatById(req: Request, res: Response) {
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

  const chatId = req.params.id;

  try {
    const chat = await db.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Chat fetched successfully",
      success: true,
      data: chat,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching chat",
      success: false,
    });
  }
}

export async function updateChat(
  req: Request<
    { id: string },
    {},
    {
      name?: string;
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

  const chatId = req.params.id;
  const { name } = req.body;

  try {
    const chat = await db.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            userId: session.user.id,
            role: "admin",
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found or unauthorized",
        success: false,
      });
    }

    const updatedChat = await db.chat.update({
      where: {
        id: chatId,
      },
      data: {
        name,
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                image: true,
              },
            },
          },
        },
        messages: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      message: "Chat updated successfully",
      success: true,
      data: updatedChat,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating chat",
      success: false,
    });
  }
}

export async function updateChatMembers(
  req: Request<
    { id: string },
    {},
    {
      addMembers?: string[];
      removeMembers?: string[];
      roleUpdates?: { userId: string; role: "admin" | "member" }[];
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

  const chatId = req.params.id;
  const { addMembers, removeMembers, roleUpdates } = req.body;

  try {
    const chat = await db.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            userId: session.user.id,
            role: "admin",
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found or unauthorized",
        success: false,
      });
    }

    // Handle member removals
    if (removeMembers?.length) {
      await db.chatParticipant.deleteMany({
        where: {
          chatId,
          userId: {
            in: removeMembers,
          },
        },
      });
    }

    // Handle new members
    if (addMembers?.length) {
      await db.chatParticipant.createMany({
        data: addMembers.map((userId) => ({
          chatId,
          userId,
          role: "member",
        })),
        skipDuplicates: true,
      });
    }

    // Handle role updates
    if (roleUpdates?.length) {
      await Promise.all(
        roleUpdates.map((update) =>
          db.chatParticipant.update({
            where: {
              userId_chatId: {
                chatId,
                userId: update.userId,
              },
            },
            data: {
              role: update.role,
            },
          })
        )
      );
    }

    const updatedChat = await db.chat.findUnique({
      where: {
        id: chatId,
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      message: "Chat members updated successfully",
      success: true,
      data: updatedChat,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating chat members",
      success: false,
    });
  }
}

export async function deleteChat(req: Request, res: Response) {
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

  const chatId = req.params.id;

  try {
    // Check if user is admin of the group
    const chat = await db.chat.findFirst({
      where: {
        id: chatId,
        participants: {
          some: {
            userId: session.user.id,
            role: "admin",
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found or unauthorized",
        success: false,
      });
    }

    // Delete the chat and all related records (cascade delete will handle this)
    await db.chat.delete({
      where: {
        id: chatId,
      },
    });

    return res.status(200).json({
      message: "Chat deleted successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting chat",
      success: false,
    });
  }
}
