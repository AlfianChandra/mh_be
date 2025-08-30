import mongoose from "mongoose";
const modeSchema = mongoose.Schema({
  mode: {
    type: String,
    required: true,
    default: "dev",
  },
  active: {
    type: Boolean,
    required: true,
    default: true,
  },
});
export const Mode = mongoose.model("Mode", modeSchema);
export default Mode;
