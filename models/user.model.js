import mongoose from "mongoose";
const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: false,
    unique: true,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    required: true,
  },
});

const User = mongoose.model("User", userSchema);
export default User;
