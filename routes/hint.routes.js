import express from "express";
import hintControllerBuilder from "../controllers/hint.controller.js";
import { verifyRequest } from "../middlewares/jwtverifier.middleware.js";
import { globalLimiter } from "../middlewares/ratelimit.middleware.js";
const router = express.Router();

router.post(
  "/hints/save",
  globalLimiter,
  verifyRequest,
  hintControllerBuilder().saveHint
);
router.post(
  "/hints/get",
  globalLimiter,
  verifyRequest,
  hintControllerBuilder().getHints
);
router.post(
  "/hints/delete",
  globalLimiter,
  verifyRequest,
  hintControllerBuilder().deleteHint
);
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
router.post(
  "/hints/update_content",
  globalLimiter,
  hintControllerBuilder().updateHintContent
);

router.post(
  "/hints/update",
  globalLimiter,
  hintControllerBuilder().updateHint
);
export default router;
