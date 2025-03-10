import express, { Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import cors from "cors";
import usersRouter from "./routes/users";
import subscriptionsRouter from "./routes/subscriptions";

import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

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

app.options("*", (req, res) => {
  res.status(200).end();
});

// Add body parsing middleware
app.use(express.json());

app.use("/api/users", usersRouter);
app.use("/api/subscriptions", subscriptionsRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
