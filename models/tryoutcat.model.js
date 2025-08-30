import mongoose from "mongoose";
const catSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  price: {
    type: Number,
    required: false,
    default: 0,
  },
  discount: {
    type: Number,
    required: false,
    default: 0,
  },
  show: {
    type: Boolean,
    default: true,
  },
});

export const TryoutCat = mongoose.model("TryoutCat", catSchema);
export default TryoutCat;
