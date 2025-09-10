import express from "express";
import userControllerBuilder from "../controllers/user.controller.js";
import { globalLimiter } from "../middlewares/ratelimit.middleware.js";
const router = express.Router();

router.post("/users/get", userControllerBuilder().getUsers);
router.get("/users/authorize", (req, res) => {
  return res.status(200);
});
export default router;
