import mongoose from "mongoose";
const mongooseSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  structure: {
    type: String,
    required: true,
  },
  order: {
    type: Number,
    required: false,
    default: 0,
  },
  locked: {
    type: Boolean,
    required: false,
    default: false,
  },
});

export const HintStructure = mongoose.model("HintStructure", mongooseSchema);
export default HintStructure;
