import express from "express";
import authController from "../controllers/auth.controller.js";
import { loginLimiter } from "../middlewares/ratelimit.middleware.js";
const router = express.Router();

router.post("/auth/login", loginLimiter, authController().loginAdmin);

export default router;
