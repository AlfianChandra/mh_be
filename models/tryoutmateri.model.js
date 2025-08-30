import mongoose from "mongoose";
const materiSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  id_tryout: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tryout",
    required: true,
  },
});

export const TryoutMateri = mongoose.model("TryoutMateri", materiSchema);
export default TryoutMateri;
