import mongoose from "mongoose";
import Question from "../models/question.model.js";

const questionControllerBuilder = () => {
  const createQuestion = async (req, res) => {
    try {
      const { question, id_tryout, id_tryoutmateri, options } = req.body;

      if (!question || !id_tryout || !id_tryoutmateri || !options) {
        return res.status(400).json({
          message: "missing_fields",
          err_code: "QUESTION_MISSING_FIELDS",
        });
      }

      if (typeof question !== "string") {
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_FIELD_TYPE",
        });
      }

      if (!Array.isArray(options) || options.length === 0) {
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_OPTIONS_TYPE",
        });
      }

      if (
        !mongoose.Types.ObjectId.isValid(id_tryout) ||
        !mongoose.Types.ObjectId.isValid(id_tryoutmateri)
      ) {
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_ID_TYPE",
        });
      }

      const newQuestion = new Question({
        question,
        id_tryout: id_tryout,
        id_tryoutmateri: id_tryoutmateri,
        options,
      });

      await newQuestion.save();

      const response = {
        message: "question_created",
        success_code: "QUESTION_CREATED",
      };
      //emitter.emit("system:question:created", response);
      return res.status(201).json(response);
    } catch (error) {
      logger.error(
        "[QUESTION CTRL] Create Question: Error creating question:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const getQuestions = async (req, res) => {
    try {
      const { id_tryout } = req.body;
      if (!mongoose.Types.ObjectId.isValid(id_tryout)) {
        logger.warn("[QUESTION CTRL] Get Questions: Invalid tryout ID");
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_TRYOUT_ID_TYPE",
        });
      }

      const questions = await Question.find({
        id_tryout,
      });

      return res.status(200).json({
        message: "questions_fetched",
        success_code: "QUESTIONS_FETCHED",
        payload: questions,
      });
    } catch (error) {
      logger.error(
        "[QUESTION CTRL] Create Question: Error creating question:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const getQuestion = async (req, res) => {
    try {
      const { id } = req.body;
      if (typeof id !== "string") {
        logger.warn("[QUESTION CTRL] Get Question: Invalid question ID");
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_ID_TYPE",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        logger.warn("[QUESTION CTRL] Get Question: Invalid question ID");
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_ID_TYPE",
        });
      }

      const question = await Question.findById(id);
      if (!question) {
        logger.warn("[QUESTION CTRL] Get Question: Question not found");
        return res.status(404).json({
          message: "question_not_found",
          err_code: "QUESTION_NOT_FOUND",
        });
      }

      return res.status(200).json({
        message: "question_fetched",
        success_code: "QUESTION_FETCHED",
        payload: question,
      });
    } catch (error) {
      logger.error(
        "[QUESTION CTRL] Create Question: Error creating question:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const deleteQuestion = async (req, res) => {
    try {
      const { id } = req.body;
      if (typeof id !== "string") {
        logger.warn("[QUESTION CTRL] Delete Question: Invalid question ID");
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_ID_TYPE",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        logger.warn("[QUESTION CTRL] Delete Question: Invalid question ID");
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_ID_TYPE",
        });
      }

      const deleted = await Question.findByIdAndDelete(id);
      if (!deleted) {
        logger.warn("[QUESTION CTRL] Delete Question: Question not found");
        return res.status(404).json({
          message: "question_not_found",
          err_code: "QUESTION_NOT_FOUND",
        });
      }

      return res.status(200).json({
        message: "question_deleted",
        success_code: "QUESTION_DELETED",
      });
    } catch (error) {
      logger.error(
        "[QUESTION CTRL] Create Question: Error creating question:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const updateQuestion = async (req, res) => {
    try {
      const { id, updateFilters } = req.body;
      if (typeof id !== "string") {
        logger.warn("[QUESTION CTRL] Update Question: Invalid question ID");
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_ID_TYPE",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        logger.warn("[QUESTION CTRL] Update Question: Invalid question ID");
        return res.status(400).json({
          message: "invalid_field_type",
          err_code: "QUESTION_INVALID_ID_TYPE",
        });
      }

      const allowedUpdates = ["question", "id_tryout", "id_tryoutmateri"];
      const safeUpdates = {};
      for (const key of allowedUpdates) {
        if (key in updateFilters) safeUpdates[key] = updateFilters[key];
      }
      const updated = await Question.findByIdAndUpdate(id, updateFilters, {
        new: true,
      });

      if (!updated) {
        logger.warn("[QUESTION CTRL] Update Question: Question not found");
        return res.status(404).json({
          message: "question_not_found",
          err_code: "QUESTION_NOT_FOUND",
        });
      }

      return res.status(200).json({
        message: "question_updated",
        success_code: "QUESTION_UPDATED",
        payload: updated,
      });
    } catch (error) {
      logger.error(
        "[QUESTION CTRL] Create Question: Error creating question:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  return {
    createQuestion,
    getQuestions,
    getQuestion,
    deleteQuestion,
    updateQuestion,
  };
};

const questionBuilder = questionControllerBuilder();
export default questionBuilder;
