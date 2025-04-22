import { Request, Response } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../lib/prisma";
import { getReceiverSocketId, io } from "../lib/socket";
import { uploadToCloudinary } from "../lib/cloudinary"; // Assuming you have a cloudinary upload function

export async function sendMessage(req: Request, res: Response) {
  console.log("Backend: sendMessage called");

  try {
    const headers = fromNodeHeaders(req.headers);
    const session = await auth.api.getSession({
      headers: headers,
    });

    if (!session) {
      console.log("Backend: No session found");
      return res.status(401).send({
        message: "Unauthorized",
        success: false,
      });
    }

    console.log("Backend: Auth OK, user:", session.user.id);
    const chatId = req.params.chatId;
    const { content, type, fileName, fileSize, fileData, replyToId } = req.body;

    console.log("Backend: Message params:", {
      chatId,
      type,
      hasFileData: !!fileData,
      fileDataLength: fileData?.length,
      fileName,
      fileSize,
      hasReply: !!replyToId,
    });

    let fileUrl = "";

    // Handle file uploads
    if (fileData && (type === "file" || type === "image")) {
      console.log("Backend: Uploading file to Cloudinary");
      try {
        const uploadResult = await uploadToCloudinary.upload(
          fileData,
          type === "image" ? "images" : "files"
        );
        fileUrl = uploadResult.secure_url;
        console.log("Backend: File uploaded successfully", {
          fileUrl: fileUrl.substring(0, 50) + "...", // Log partial URL for privacy
        });
      } catch (uploadError: any) {
        console.error("Backend: Cloudinary upload error:", uploadError);
        return res.status(500).json({
          message: "Error uploading file",
          success: false,
          error: uploadError.message,
        });
      }
    }

    console.log("Backend: Creating message in database");
    const message = await db.message.create({
      data: {
        content: type === "text" ? content : fileUrl,
        type,
        fileName,
        fileSize,
        fileUrl,
        senderId: session.user.id,
        chatId,
        status: "sent",
        replyToId: replyToId || null, // Add the replyToId
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            image: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    console.log("Backend: Message created:", { messageId: message.id });

    const chatParticipants = await db.chatParticipant.findMany({
      where: {
        chatId: chatId,
        userId: {
          not: session.user.id,
        },
      },
    });

    // Emit to all participants
    chatParticipants.forEach((participant) => {
      const receiverSocketId = getReceiverSocketId(participant.userId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", {
          ...message,
          chatId, // Make sure chatId is included
        });
      }
    });

    return res.status(200).json({
      message: "Message sent successfully",
      success: true,
      data: message,
    });
  } catch (error: any) {
    console.error("Backend error in sendMessage:", error);
    return res.status(500).json({
      message: "Error creating message",
      success: false,
      error: error.message,
    });
  }
}

export async function getMessages(req: Request, res: Response) {
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

  const chatId = req.params.chatId;
  const cursor = req.query.cursor as string | undefined;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    const messages = await db.message.findMany({
      where: { chatId },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "asc" }, // Change to ascending order
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            image: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    const hasMore = messages.length > limit;
    const nextCursor = hasMore ? messages[limit - 1].id : undefined;
    const data = hasMore ? messages.slice(0, -1) : messages;

    return res.status(200).json({
      message: "Messages retrieved successfully",
      success: true,
      data: {
        messages: data,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error retrieving messages",
      success: false,
    });
  }
}

export async function updateMessageStatus(req: Request, res: Response) {
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

  const { messageId } = req.params;
  const { status } = req.body;

  try {
    const message = await db.message.update({
      where: { id: messageId },
      data: { status },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Emit status update to sender
    io.to(`user_${message.senderId}`).emit("message:status", {
      messageId: message.id,
      status,
    });

    return res.status(200).json({
      message: "Message status updated successfully",
      success: true,
      data: message,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating message status",
      success: false,
    });
  }
}

export async function searchMessages(req: Request, res: Response) {
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

  const chatId = req.params.chatId;
  const query = req.query.q as string;

  try {
    const messages = await db.message.findMany({
      where: {
        chatId,
        content: {
          contains: query,
          mode: "insensitive",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            email: true,
            image: true,
          },
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      message: "Messages found successfully",
      success: true,
      data: messages,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error searching messages",
      success: false,
    });
  }
}

export async function deleteMessage(req: Request, res: Response) {
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

  const { messageId } = req.params;

  try {
    const message = await db.message.findFirst({
      where: {
        id: messageId,
        senderId: session.user.id, // Only allow deletion of own messages
      },
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found or unauthorized",
        success: false,
      });
    }

    await db.message.delete({
      where: { id: messageId },
    });

    // Emit message deletion event to all participants in the chat
    io.to(`chat_${message.chatId}`).emit("message:delete", {
      messageId: message.id,
    });

    return res.status(200).json({
      message: "Message deleted successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting message",
      success: false,
    });
  }
}
