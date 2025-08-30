import logger from "../utils/logger.utils.js";
import TryoutCat from "../models/tryoutcat.model.js";
import Tryout from "../models/tryout.model.js";
import TryoutMateri from "../models/tryoutmateri.model.js";
import mongoose from "mongoose";
import emitter from "../utils/eventBus.js";

export const tryoutControllerBuilder = () => {
  const createCategory = async (req, res) => {
    try {
      const { name, description, show, price, discount } = req.body;
      //validate
      if (typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_CAT_INVALID_REQUEST_NAME",
        });
      }
      if (typeof description !== "string" || description.trim() === "") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_CAT_INVALID_REQUEST_DESCRIPTION",
        });
      }
      if (typeof show !== "boolean") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_CAT_INVALID_REQUEST_SHOW",
        });
      }

      if (typeof price !== "number" || price < 0) {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_CAT_INVALID_REQUEST_PRICE",
        });
      }
      if (typeof discount !== "number" || discount < 0) {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_CAT_INVALID_REQUEST_DISCOUNT",
        });
      }

      const newCategory = new TryoutCat({
        name,
        description,
        price,
        discount,
        show,
      });
      await newCategory.save();
      logger.info(
        "[TRYOUT CTRL] Create Tryout Category: Category created successfully:",
        newCategory
      );
      return res.status(201).json({
        message: "category_created",
        success_code: "TRYOUT_CAT_CREATED",
        payload: newCategory,
      });
    } catch (error) {
      logger.warn(
        "[TRYOUT CTRL] Create Tryout Category: Error creating category:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const getCategories = async (req, res) => {
    try {
      const { key } = req.body;

      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const safeKey = escapeRegex(key || "");
      const categories = await TryoutCat.find({
        name: { $regex: safeKey, $options: "i" },
      });
      return res.status(200).json({
        message: "ok",
        success_code: "TRYOUT_CAT_OK",
        payload: categories,
      });
    } catch (error) {
      logger.warn(
        "[TRYOUT CTRL] Get Tryout Categories: Error getting categories:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const getCategory = async (req, res) => {
    try {
      const { id } = req.body;
      if (typeof id !== "string") {
        logger.warn(
          "[TRYOUT CTRL] Get Tryout Category: Invalid category ID:",
          id
        );
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_CAT_INVALID_REQUEST_ID",
        });
      }

      const cat = await TryoutCat.findById(id);
      if (!cat) {
        logger.warn(
          "[TRYOUT CTRL] Get Tryout Category: Category not found:",
          id
        );
        return res
          .status(404)
          .json({ message: "not_found", err_code: "TRYOUT_CAT_NOT_FOUND" });
      }

      return res
        .status(200)
        .json({ message: "ok", success_code: "TRYOUT_CAT_OK", payload: cat });
    } catch (error) {
      logger.warn(
        "[TRYOUT CTRL] Get Tryout Category: Error getting category:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const deleteCategory = async (req, res) => {
    try {
      const { id } = req.body;
      if (typeof id !== "string") {
        logger.warn(
          "[TRYOUT CTRL] Delete Category: " + id + " is not a string",
          deletedCategory
        );
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_CAT_INVALID_REQUEST_ID",
        });
      }
      const deletedCategory = await TryoutCat.findByIdAndDelete(id);
      if (!deletedCategory) {
        return res.status(404).json({
          message: "not_found",
          err_code: "TRYOUT_CAT_NOT_FOUND",
        });
      }
      logger.info(
        "[TRYOUT CTRL] Delete Category: Category deleted successfully:",
        deletedCategory
      );
      return res.status(200).json({
        message: "category_deleted",
        success_code: "TRYOUT_CAT_DELETED",
      });
    } catch (error) {
      logger.warn(
        "[TRYOUT CTRL] Delete Category: Error deleting category:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const updateCategory = async (req, res) => {
    try {
      const { id, ...updateFilters } = req.body;
      if (typeof id !== "string") {
        logger.warn(
          "[TRYOUT CTRL] Update Category: " + id + " is not a string",
          updatedCategory
        );
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_CAT_INVALID_REQUEST_ID",
        });
      }

      const allowedUpdates = ["name", "description", "show"];
      const safeUpdates = {};
      for (const key of allowedUpdates) {
        if (key in updateFilters) safeUpdates[key] = updateFilters[key];
      }

      const updatedCategory = await TryoutCat.findByIdAndUpdate(
        id,
        safeUpdates,
        { new: true }
      );
      if (!updatedCategory) {
        return res.status(404).json({
          message: "not_found",
          err_code: "TRYOUT_CAT_NOT_FOUND",
        });
      }
      logger.info(
        "[TRYOUT CTRL] Update Tryout Category: Category updated successfully:",
        updatedCategory
      );
      return res.status(200).json({
        message: "ok",
        success_code: "TRYOUT_CAT_OK",
        payload: updatedCategory,
      });
    } catch (error) {
      logger.warn(
        "[TRYOUT CTRL] Update Tryout Category: Error updating category:",
        error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const createTryout = async (req, res) => {
    try {
      const { name, description, id_tryoutcat, visible } = req.body;
      // Validate input
      if (typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_INVALID_REQUEST_NAME",
        });
      }
      if (typeof description !== "string" || description.trim() === "") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_INVALID_REQUEST_DESCRIPTION",
        });
      }
      if (!id_tryoutcat || !mongoose.Types.ObjectId.isValid(id_tryoutcat)) {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_INVALID_REQUEST_ID",
        });
      }
      if (typeof visible !== "boolean") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_INVALID_REQUEST_VISIBLE",
        });
      }

      const newTryout = new Tryout({
        name,
        description,
        id_tryoutcat,
        visible,
      });
      await newTryout.save();
      logger.info(
        "[TRYOUT CTRL] Create Tryout: Tryout created successfully:",
        newTryout
      );
      const response = {
        message: "created",
        success_code: "TRYOUT_CREATED",
        payload: newTryout,
      };
      return res.status(201).json(response);
    } catch (error) {
      logger.warn("[TRYOUT CTRL] Create Tryout: Error creating tryout:", error);
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const getTryouts = async (req, res) => {
    try {
      const { key } = req.body;
      if (typeof key !== "string") {
        logger.warn("[TRYOUT CTRL] Get Tryouts: " + key + " is not a string");
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_INVALID_REQUEST_KEY",
        });
      }
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const safeKey = escapeRegex(key || "");
      const tryouts = await Tryout.find({
        name: { $regex: safeKey, $options: "i" },
      });
      return res.status(200).json({
        message: "ok",
        success_code: "TRYOUT_OK",
        payload: tryouts,
      });
    } catch (error) {
      logger.warn(
        "[TRYOUT CTRL] Get Tryouts: Error retrieving tryouts:" + error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const getTryout = async (req, res) => {
    try {
      const { id } = req.body;
      if (!typeof id === "string") {
        logger.warn("[TRYOUT CTRL] Get Tryout: " + id + " is not a string");
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_INVALID_REQUEST_ID",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        logger.warn("[TRYOUT CTRL] Get Tryout: Invalid ObjectId:", id);
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_INVALID_REQUEST_ID",
        });
      }

      const tryout = await Tryout.findById(id);
      return res.status(200).json({
        message: "ok",
        success_code: "TRYOUT_OK",
        payload: tryout,
      });
    } catch (error) {
      logger.error(
        "[TRYOUT CTRL] Get Tryout: Error retrieving tryout:" + error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const updateTryout = async (req, res) => {
    try {
      const { id, updateFilters } = req.body;
      const allowedUpdates = ["name", "description", "visible", "id_tryoutcat"];
      const safeUpdates = {};
      for (const key of allowedUpdates) {
        if (key in updateFilters) safeUpdates[key] = updateFilters[key];
      }

      const updatedCategory = await Tryout.findByIdAndUpdate(id, safeUpdates, {
        new: true,
      });
      if (!updatedCategory) {
        return res
          .status(404)
          .json({ message: "not_found", err_code: "TRYOUT_NOT_FOUND" });
      }
      return res.status(200).json({ message: "ok", success_code: "TRYOUT_OK" });
    } catch (error) {
      logger.error("[TRYOUT CTRL] Update Tryout:" + error);
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const deleteTryout = async (req, res) => {
    try {
      const { id } = req.body;
      if (typeof id !== "string") {
        logger.warn("[TRYOUT CTRL] Delete Tryout: " + id + " is not a string");
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_INVALID_REQUEST_ID",
        });
      }

      const deleteTryout = await Tryout.findByIdAndDelete(id);
      if (!deleteTryout) {
        logger.warn("[TRYOUT CTRL] Delete Tryout: Tryout not found");
        return res
          .status(400)
          .json({ message: "not_found", err_code: "TRYOUT_NOT_FOUND" });
      }

      logger.info("[TRYOUT CTRL] Delete Tryout: Tryout deleted");
      return res.status(200).json({ message: "ok", success_code: "TRYOUT_OK" });
    } catch (error) {
      logger.error(
        "[TRYOUT CTRL] Delete Tryout: Error retrieving tryout:" + error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const createMateri = async (req, res) => {
    try {
      const { name, description, id_tryout } = req.body;
      if (typeof name !== "string" || typeof description !== "string") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_MATERI_INVALID_REQUEST",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id_tryout)) {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_MATERI_INVALID_REQUEST_ID",
        });
      }

      const newMateri = new TryoutMateri({
        name,
        description,
        id_tryout,
      });

      await newMateri.save();
      return res.status(201).json({
        message: "ok",
        success_code: "TRYOUT_MATERI_OK",
      });
    } catch (error) {
      logger.error(
        "[TRYOUT CTRL] Create Materi: Error creating materi:" + error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const deleteMateri = async (req, res) => {
    try {
      const { id } = req.body;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_MATERI_INVALID_REQUEST_ID",
        });
      }

      const deleteMateri = await TryoutMateri.findByIdAndDelete(id);
      if (!deleteMateri) {
        return res.status(404).json({
          message: "not_found",
          err_code: "TRYOUT_MATERI_NOT_FOUND",
        });
      }

      logger.info("[TRYOUT CTRL] Delete Materi: Materi deleted");
      return res
        .status(200)
        .json({ message: "ok", success_code: "TRYOUT_MATERI_DELETED" });
    } catch (error) {
      logger.error(
        "[TRYOUT CTRL] Create Materi: Error deleting materi:" + error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const getMateries = async (req, res) => {
    try {
      const { key, id_tryout } = req.body;
      if (typeof key !== "string") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_MATERI_INVALID_REQUEST_KEY",
        });
      }

      if (typeof id_tryout !== "string") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_MATERI_INVALID_REQUEST_ID",
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id_tryout)) {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_MATERI_INVALID_REQUEST_ID",
        });
      }

      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const safeKey = escapeRegex(key || "");
      const materies = await TryoutMateri.find({
        name: { $regex: safeKey, $options: "i" },
        id_tryout: id_tryout,
      });
      return res.status(200).json({
        message: "ok",
        success_code: "TRYOUT_MATERI_OK",
        payload: materies,
      });
    } catch (error) {
      logger.error(
        "[TRYOUT CTRL] Create Materi: Error getting materies:" + error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const getMateri = async (req, res) => {
    try {
      const { id } = req.body;
      if (typeof id !== "string") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "TRYOUT_MATERI_INVALID_REQUEST_ID",
        });
      }

      const materi = await TryoutMateri.findById(id);
      if (!materi) {
        return res.status(404).json({
          message: "not_found",
          err_code: "TRYOUT_MATERI_NOT_FOUND",
        });
      }

      return res.status(200).json({
        message: "ok",
        success_code: "TRYOUT_MATERI_OK",
        payload: materi,
      });
    } catch (error) {
      logger.error(
        "[TRYOUT CTRL] Create Materi: Error getting materi:" + error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const updateMateri = async (req, res) => {
    try {
      const { id, updateFilters } = req.body;
      const allowedUpdates = ["name", "description", "id_tryout"];
      const safeUpdates = {};
      for (const key of allowedUpdates) {
        if (key in updateFilters) safeUpdates[key] = updateFilters[key];
      }

      const updatedMateri = await TryoutMateri.findByIdAndUpdate(
        id,
        safeUpdates,
        { new: true }
      );
      if (!updatedMateri) {
        return res.status(404).json({
          message: "not_found",
          err_code: "TRYOUT_MATERI_NOT_FOUND",
        });
      }

      return res.status(200).json({
        message: "ok",
        success_code: "TRYOUT_MATERI_UPDATED",
      });
    } catch (error) {
      logger.error(
        "[TRYOUT CTRL] Create Materi: Error updating materi:" + error
      );
      return res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  return {
    createCategory,
    getCategories,
    getCategory,
    deleteCategory,
    updateCategory,
    createTryout,
    getTryouts,
    getTryout,
    updateTryout,
    deleteTryout,
    createMateri,
    getMateries,
    getMateri,
    deleteMateri,
    updateMateri,
  };
};

const tryoutBuilder = tryoutControllerBuilder();
export default tryoutBuilder;
