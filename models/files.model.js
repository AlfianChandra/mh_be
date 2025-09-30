import mongoose from "mongoose";
const fileSchema = mongoose.Schema({
  id_meeting: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Meeting",
  },
  filename: {
    type: "String",
    default: "",
  },
  filetype: {
    type: String,
    default: "",
  },
});

export const Files = mongoose.model("File", fileSchema);
export default Files;
