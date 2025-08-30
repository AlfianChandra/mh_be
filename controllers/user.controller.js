import User from "../models/user.model.js";
export const userControllerBuilder = () => {
  const getUsers = async (req, res) => {
    try {
      const { key } = req.body;
      if (typeof key !== "string" || key.trim() === "") {
        return res.status(400).json({
          message: "invalid_request",
          err_code: "USER_INVALID_REQUEST",
        });
      }
      const users = await User.find({
        name: { $regex: key, $options: "i" },
      }).select("-password");
      return res.status(200).json({
        message: "ok",
        success_code: "USER_OK",
        payload: users,
      });
    } catch (error) {
      logger.warn("[USER CTRL] Error fetching users:", error);
      res.status(500).json({
        message: "internal_error",
        err_code: "INTERNAL_ERROR",
      });
    }
  };

  return {
    getUsers,
  };
};

export default userControllerBuilder;
