import mongoose from "mongoose";
const chunkSchema = mongoose.Schema({
  id_file: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "File",
  },
  chunk: {
    type: String,
    required: true,
  },
  vector: {
    type: Array,
    required: true,
  },
});

export const FileChunk = mongoose.model("FileChunk", chunkSchema);
export default FileChunk;
