import express from "express";
import questionBuilder from "../controllers/question.controller.js";
const router = express.Router();
router.post("/question/create", questionBuilder.createQuestion);
router.post("/question/collect", questionBuilder.getQuestions);
router.post("/question/get", questionBuilder.getQuestion);
router.post("/question/delete", questionBuilder.deleteQuestion);
router.post("/question/update", questionBuilder.updateQuestion);

export default router;
