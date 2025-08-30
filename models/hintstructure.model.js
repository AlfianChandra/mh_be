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
});

export const HintStructure = mongoose.model("HintStructure", mongooseSchema);
export default HintStructure;
