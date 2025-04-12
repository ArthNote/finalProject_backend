import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import usersRouter from "./routes/users";
import subscriptionsRouter from "./routes/subscriptions";
import tasksRouter from "./routes/tasks";
import friendsRouter from "./routes/friends";
import chatsRouter from "./routes/chats";
import messagesRouter from "./routes/messages";

import { app, server as socketServer } from "./lib/socket";

dotenv.config();

const PORT = process.env.PORT || 3001;

// Configure CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Increase JSON payload limit to 50MB for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.all("/api/auth/*", toNodeHandler(auth));

// Add body parsing middleware
app.use(express.json());

app.use("/api/users", usersRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/messages", messagesRouter);

socketServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
