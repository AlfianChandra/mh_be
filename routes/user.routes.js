import express from "express";
import userControllerBuilder from "../controllers/user.controller.js";
import { globalLimiter } from "../middlewares/ratelimit.middleware.js";
const router = express.Router();

router.post("/users/get", userControllerBuilder().getUsers);
export default router;
