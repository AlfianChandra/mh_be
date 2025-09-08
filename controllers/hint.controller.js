import Hint from "../models/hint.model.js";
import useOpenAiLib from "../utils/openAi.js";
import fileUploaderInstance from "../utils/fileuploader.utils.js";
import HintStructure from "../models/hintstructure.model.js";

const hintControllerBuilder = () => {
  const saveHint = async (req, res) => {
    try {
      const {
        context,
        context_type,
        context_image,
        prompt,
        hint,
        title,
        id_meeting,
      } = req.body;
      let imagePath = null;
      if (context_image.length > 0 && context_type === "image") {
        imagePath = await fileUploaderInstance.uploadImage(context_image);
      }

      const input = [
        {
          role: "system",
          content:
            "Kamu adalah asisten AI yang ditugaskan untuk membuat judul dari sebuah diskusi. Hasilkan judul dari inti pembahasan yang penting. Buat kedalam bentuk 1 paragraf yang sangat singkat saja",
        },
        {
          role: "user",
          content: `Berikut diskusinya: ${hint}`,
        },
      ];
      const newContext = await useOpenAiLib().createResponse(input);
      const newHint = new Hint({
        context: newContext,
        context_type: context_type,
        context_image: imagePath,
        prompt: prompt,
        hint: hint,
        title: title,
        id_meeting,
      });

      await newHint.save();
      return res.status(201).json({ message: "Hint saved successfully" });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  const getHints = async (req, res) => {
    try {
      const { id_meeting } = req.body;
      //Get and sort DESCENDINGLY
      const hints = await Hint.find({ id_meeting }).sort({
        is_active: -1,
        createdAt: -1,
      });
      return res.status(200).json({ payload: hints });
    } catch (err) {
      return res.status(500).json({ error: "Internal Server Error: " + err });
    }
  };

  const deleteHint = async (req, res) => {
    try {
      const { id } = req.body;
      const hint = await Hint.findById(id);
      console.log(hint);
      if (hint.context_image != null) {
        await fileUploaderInstance.deleteImage("public/" + hint.context_image);
      }
      await Hint.findByIdAndDelete(id);
      return res.status(200).json({ message: "Hint deleted successfully" });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  const createStructure = async (req, res) => {
    try {
      const { name, structure } = req.body;
      const newStructure = new HintStructure({
        name: name,
        structure: structure,
      });

      await newStructure.save();
      return res
        .status(201)
        .json({ message: "Structure created successfully" });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  const getStructures = async (req, res) => {
    try {
      const structures = await HintStructure.find();
      return res.status(200).json({ payload: structures });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  const updateStructures = async (req, res) => {
    try {
      const { id, name, structure } = req.body;
      await HintStructure.findByIdAndUpdate(
        id,
        { name, structure },
        { new: true }
      );
      return res.status(200).json({
        message: "Structure updated successfully",
      });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  const deleteStructures = async (req, res) => {
    try {
      const { id } = req.body;
      await HintStructure.findByIdAndDelete(id);
      return res
        .status(200)
        .json({ message: "Structure deleted successfully" });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  return {
    saveHint,
    getHints,
    deleteHint,
    createStructure,
    getStructures,
    updateStructures,
    deleteStructures,
  };
};

export default hintControllerBuilder;
