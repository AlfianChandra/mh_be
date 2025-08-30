import mongoose from "mongoose";
const qSchema = mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  question_medias: [
    {
      filename: {
        type: String,
        required: true,
      },
      alt_text: {
        type: String,
        required: true,
      },
    },
  ],
  id_tryout: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tryout",
    required: true,
  },
  id_tryoutmateri: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TryoutMateri",
    required: true,
  },
  options: [
    {
      option: {
        type: String,
        required: true,
      },
      isCorrect: {
        type: Boolean,
        default: false,
      },
    },
  ],
});

export const Question = mongoose.model("Question", qSchema);
export default Question;
