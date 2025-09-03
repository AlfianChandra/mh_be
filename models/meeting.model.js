import mongoose from "mongoose";
const meetingSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  raw: {
    type: String,
    required: false,
    default: "",
  },
  block: {
    type: Array,
    required: false,
    default: [],
  },
  id_user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  is_active: {
    type: Boolean,
    default: false,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Meeting = mongoose.model("Meeting", meetingSchema);
export default Meeting;
