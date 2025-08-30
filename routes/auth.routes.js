import express from "express";
import authController from "../controllers/auth.controller.js";
import {
  registerLimiter,
  loginLimiter,
} from "../middlewares/ratelimit.middleware.js";
const router = express.Router();

router.post("/auth/login", loginLimiter, authController().login);
router.post("/auth/register", registerLimiter, authController().register);

export default router;
