import mongoose from "mongoose";
const tryoutSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  id_tryoutcat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TryoutCategory",
    required: true,
  },
  visible: {
    type: Boolean,
    default: true,
    required: true
  }
});

export const Tryout = mongoose.model("Tryout", tryoutSchema);
export default Tryout;
