import express, { Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import cors from "cors";
import usersRouter from "./routes/users";

import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

const allowedOrigins = [
  process.env.BETTER_AUTH_URL!,
  "https://taskflow-six-kohl.vercel.app",
  "http://localhost:3000", // For local development
];

app.options("*", cors());

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.log("Origin not allowed by CORS:", origin);
        callback(null, true); // Still allow during development - remove in production
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.all("/api/auth/*", toNodeHandler(auth));

// Add body parsing middleware
app.use(express.json());

app.use("/api/users", usersRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
