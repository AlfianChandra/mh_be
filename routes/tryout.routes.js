import express from "express";
import tryoutBuilder from "../controllers/tryout.controller.js";
const router = express.Router();

router.post("/tryout/cat/create", tryoutBuilder.createCategory);
router.post("/tryout/cat/search", tryoutBuilder.getCategories);
router.post("/tryout/cat/get", tryoutBuilder.getCategory);
router.post("/tryout/cat/delete", tryoutBuilder.deleteCategory);
router.post("/tryout/cat/update", tryoutBuilder.updateCategory);

router.post("/tryout/create", tryoutBuilder.createTryout);
router.post("/tryout/search", tryoutBuilder.getTryouts);
router.post("/tryout/get", tryoutBuilder.getTryout);
router.post("/tryout/delete", tryoutBuilder.deleteTryout);
router.post("/tryout/update", tryoutBuilder.updateTryout);

router.post("/tryout/materi/create", tryoutBuilder.createMateri);
router.post("/tryout/materi/search", tryoutBuilder.getMateries);
router.post("/tryout/materi/get", tryoutBuilder.getMateri);
router.post("/tryout/materi/delete", tryoutBuilder.deleteMateri);
router.post("/tryout/materi/update", tryoutBuilder.updateMateri);

export default router;
