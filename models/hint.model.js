import mongoose from "mongoose";
const hintSchema = mongoose.Schema({
  context: {
    type: String,
    required: false,
    default: "",
  },
  context_type: {
    type: String,
    required: false,
    default: "",
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  context_image: {
    type: String,
    required: false,
    default: "",
  },
  prompt: {
    type: String,
    required: false,
    default: "",
  },
  hint: {
    type: String,
    required: false,
    default: "",
  },
  title: {
    type: String,
    required: false,
    default: "",
  },
  id_meeting: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Meeting",
  },
  hint_contents: {
    type: Array,
    required: false,
    default: [],
  },
  hint_images: {
    type: Array,
    required: false,
    default: [],
  },
});

export const Hint = mongoose.model("Hint", hintSchema);
export default Hint;
