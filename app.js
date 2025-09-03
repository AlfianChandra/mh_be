import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import connBuilder from "./utils/db.utils.js";
import verifyRequest from "./middlewares/jwtverifier.middleware.js";
import verifyRole from "./middlewares/roleverify.middleware.js";
import { globalLimiter } from "./middlewares/ratelimit.middleware.js";

//Routes auth
import authRoutes from "./routes/auth.routes.js";
import authAdminRoutes from "./routes/authadmin.routes.js";

//Routes hints
import hintRoutes from "./routes/hint.routes.js";

//Routes panel
import userRoutes from "./routes/user.routes.js";
import tryoutRoutes from "./routes/tryout.routes.js";
import questionRoutes from "./routes/question.routes.js";

//Meeting routes
import meetingRoutes from "./routes/meeting.routes.js";
dotenv.config({
  silent: true,
});

connBuilder().connect(process.env.DB_CONNECTION_LIVE);
const app = express();
app.disable("x-powered-by");
export default app;
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan("dev"));
app.use("/api/v1/", authRoutes); //Basic auth
app.use("/api/v1/", hintRoutes);
app.use("/api/v1/cpanel/challenge", authAdminRoutes); //Admin auth

//Static routes
app.use(
  "/static/usercontent/public",
  express.static(path.join(process.cwd(), "static/public"))
);
app.use(
  "/static/usercontent/avatar",
  express.static(path.join(process.cwd(), "static/avatar"))
);

//Panel routes
app.use(
  "/api/v1/cpanel",
  globalLimiter,
  verifyRequest,
  verifyRole().adminOnly,
  userRoutes
); //Users

app.use(
  "/api/v1/cpanel",
  globalLimiter,
  verifyRequest,
  verifyRole().adminOnly,
  tryoutRoutes
); //Tryouts

app.use(
  "/api/v1/cpanel",
  globalLimiter,
  verifyRequest,
  verifyRole().adminOnly,
  questionRoutes
); //Questions

app.use("/api/v1/", globalLimiter, verifyRequest, meetingRoutes); //Meetings
