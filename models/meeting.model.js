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
  setting: {
    viewControl: {
      invertBlock: {
        type: Boolean,
        default: false,
        required: false,
      },
      blockView: {
        type: Boolean,
        default: true,
        required: false,
      },
      columnSizes: {
        type: Array,
        default: [33.333333333, 33.333333333, 33.333333333],
        required: false,
      },
      useFiles: {
        type: Boolean,
        default: false,
        required: false,
      },
    },
    structure: {
      id_structure: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "HintStructure",
        required: false,
        default: null,
      },
    },
    languages: {
      transcription: {
        type: String,
        default: "id",
        required: false,
      },
      hint: {
        type: String,
        default: "id",
        required: false,
      },
    },
  },
});

export const Meeting = mongoose.model("Meeting", meetingSchema);
export default Meeting;
