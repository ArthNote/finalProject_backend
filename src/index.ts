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
import projectsRouter from "./routes/projects";

import { app, server as socketServer } from "./lib/socket";

dotenv.config();

const PORT = process.env.PORT || 8080;

// Configure CORS
app.use(
  cors({
    origin: process.env.BETTER_AUTH_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-CSRF-Token",
      "Accept",
      "Accept-Version",
      "Content-Length",
      "Content-MD5",
      "Date",
      "X-Api-Version",
    ],
  })
);

app.options("*", cors());

app.all("/api/auth/*", toNodeHandler(auth));

// Increase JSON payload limit to 50MB for file uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
// Add body parsing middleware
app.use(express.json());

app.options("*", (req, res) => {
  res.status(200).end();
});

app.use("/api/users", usersRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/projects", projectsRouter);

socketServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
