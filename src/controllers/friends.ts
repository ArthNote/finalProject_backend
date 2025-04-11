import { Request, Response } from "express";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";
import { db } from "../lib/prisma";

export async function getFriends(req: Request, res: Response) {
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
    const friends = await db.friendship.findMany({
      where: {
        OR: [
          { senderId: session.user.id, status: "accepted" },
          { receiverId: session.user.id, status: "accepted" },
        ],
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
        receiver: {
          select: {
            id: true,
            username: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Friends fetched successfully",
      success: true,
      data: friends,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error fetching friends", success: false });
  }
}

export async function sendFriendRequest(
  req: Request<
    {},
    {},
    {
      userId: string;
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

  const { userId } = req.body;

  if (!userId) {
    return res.status(401).send({
      message: "User ID is required",
      success: false,
    });
  }

  try {
    // Check if the userId is valid and exists in the database
    const user = await db.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return res.status(401).send({
        message: "User not found",
        success: false,
      });
    }

    // Check if friendship already exists
    const existingFriendship = await db.friendship.findFirst({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: userId },
          { senderId: userId, receiverId: session.user.id },
        ],
      },
    });

    if (existingFriendship) {
      return res.status(200).json({
        message: "Friendship already exists",
        success: true,
        code: "friendship_exists",
      });
    }

    // Create new friendship request
    await db.friendship.create({
      data: {
        senderId: session.user.id,
        receiverId: userId,
        status: "pending",
      },
    });

    return res.status(200).json({
      message: "Friend request sent successfully",
      success: true,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error sending friend request", success: false });
  }
}

export async function respondToFriendRequest(
  req: Request<{}, {}, { friendshipId: string; action: string }>,
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

  const { friendshipId, action } = req.body;

  if (!friendshipId || !action) {
    return res.status(400).json({
      message: "Friendship ID and action are required",
      success: false,
    });
  }

  try {
    const friendship = await db.friendship.findFirst({
      where: {
        id: friendshipId,
        receiverId: session.user.id,
        status: "pending",
      },
    });

    if (!friendship) {
      return res
        .status(404)
        .json({ message: "Friend request not found", success: false });
    }

    if (action === "accept") {
      await db.friendship.update({
        where: { id: friendshipId },
        data: { status: "accepted" },
      });
    } else {
      await db.friendship.delete({
        where: { id: friendshipId },
      });
    }

    return res
      .status(200)
      .json({ message: "Request processed successfully", success: true });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error processing friend request", success: false });
  }
}

export async function deleteFriendship(
  req: Request<{}, {}, { friendshipId: string }>,
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

  const { friendshipId } = req.body;

  if (!friendshipId) {
    return res.status(400).json({
      message: "Friendship ID is required",
      success: false,
    });
  }

  try {
    const friendship = await db.friendship.findUnique({
      where: {
        id: friendshipId,
        OR: [{ senderId: session.user.id }, { receiverId: session.user.id }],
      },
    });

    if (!friendship) {
      return res.status(404).json({
        message: "Friendship not found",
        success: false,
      });
    }

    await db.friendship.delete({
      where: { id: friendshipId },
    });

    return res.status(200).json({
      message: "Friendship deleted successfully",
      success: true,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Error deleting friendship", success: false });
  }
}

export async function getFriendRequests(req: Request, res: Response) {
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
    const received = await db.friendship.findMany({
      where: {
        receiverId: session.user.id,
        status: "pending",
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
      },
    });

    const sent = await db.friendship.findMany({
      where: {
        senderId: session.user.id,
        status: "pending",
      },
      include: {
        receiver: {
          select: {
            id: true,
            username: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Friend requests fetched successfully",
      success: true,
      data: { received, sent },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error fetching friend requests",
      success: false,
    });
  }
}

export async function cancelFriendRequest(
  req: Request<{}, {}, { friendshipId: string }>,
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

  const { friendshipId } = req.body;

  if (!friendshipId) {
    return res.status(400).json({
      message: "Friendship ID is required",
      success: false,
    });
  }

  try {
    const friendship = await db.friendship.findFirst({
      where: {
        id: friendshipId,
        senderId: session.user.id,
        status: "pending",
      },
    });

    if (!friendship) {
      return res.status(404).json({
        message: "Friend request not found",
        success: false,
      });
    }

    await db.friendship.delete({
      where: { id: friendshipId },
    });

    return res.status(200).json({
      message: "Friend request canceled successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error canceling friend request",
      success: false,
    });
  }
}

export async function searchUsers(req: Request, res: Response) {
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

  const query = req.query.q as string;

  if (!query || query.length < 2) {
    return res.status(200).json({
      message: "Search term too short",
      success: true,
      data: [],
    });
  }

  try {
    // Search users by username, name, or email
    const users = await db.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { username: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          { id: { not: session.user.id } }, // Exclude current user
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        image: true,
      },
      take: 10,
    });

    // Check existing friendships
    const existingFriendships = await db.friendship.findMany({
      where: {
        OR: [{ senderId: session.user.id }, { receiverId: session.user.id }],
      },
    });

    const usersWithStatus = users.map((user) => ({
      ...user,
      friendshipStatus:
        existingFriendships.find(
          (f) => f.senderId === user.id || f.receiverId === user.id
        )?.status || "none",
      hasPendingRequest: existingFriendships.some(
        (f) =>
          f.status === "pending" &&
          ((f.senderId === session.user.id && f.receiverId === user.id) ||
            (f.receiverId === session.user.id && f.senderId === user.id))
      ),
    }));

    return res.status(200).json({
      message: "Users found",
      success: true,
      data: usersWithStatus,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error searching users",
      success: false,
    });
  }
}
