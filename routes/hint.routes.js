import express from "express";
import hintControllerBuilder from "../controllers/hint.controller.js";
import { globalLimiter } from "../middlewares/ratelimit.middleware.js";
const router = express.Router();

router.post("/hints/save", globalLimiter, hintControllerBuilder().saveHint);
router.get("/hints/get", globalLimiter, hintControllerBuilder().getHints);
router.post("/hints/delete", globalLimiter, hintControllerBuilder().deleteHint);
router.post(
  "/hints/structure/create",
  globalLimiter,
  hintControllerBuilder().createStructure
);
router.get(
  "/hints/structure/get",
  globalLimiter,
  hintControllerBuilder().getStructures
);
router.post(
  "/hints/structure/update",
  globalLimiter,
  hintControllerBuilder().updateStructures
);
router.post(
  "/hints/structure/delete",
  globalLimiter,
  hintControllerBuilder().deleteStructures
);
export default router;
