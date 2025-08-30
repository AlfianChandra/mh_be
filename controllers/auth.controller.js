import dotenv from "dotenv";
dotenv.config({ silent: true });
import validator from "../utils/validator.utils.js";
import User from "../models/user.model.js";
import argon2 from "argon2";
import logger from "../utils/logger.utils.js";
import jwt from "jsonwebtoken";

export const authControllerBuilder = () => {
  const loginAdmin = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (email === undefined || password === undefined) {
        logger.warn("[AUTH - ADMIN LOGIN] Invalid request");
        return res.status(400).json({
          message: "invalid_request",
          err_code: "AUTH_INVALID_REQUEST",
        });
      }

      if (typeof email !== "string" || typeof password !== "string") {
        logger.warn("[AUTH - ADMIN LOGIN] Invalid request");
        return res.status(400).json({
          message: "invalid_request",
          err_code: "AUTH_INVALID_REQUEST",
        });
      }

      const isExist = await User.findOne({ email: email, role: "admin" });
      if (!isExist) {
        logger.warn("[AUTH - ADMIN LOGIN] User not found");
        return res
          .status(404)
          .json({ message: "user_not_found", err_code: "AUTH_USER_NOT_FOUND" });
      }

      const isPasswordValid = await argon2.verify(isExist.password, password);
      if (!isPasswordValid) {
        logger.warn("[AUTH - ADMIN LOGIN] Invalid password");
        return res.status(404).json({
          message: "invalid_password",
          err_code: "AUTH_USER_NOT_FOUND",
        });
      }

      const role = isExist.role;
      const token = jwt.sign(
        { id_user: isExist._id, role, email: isExist.email },
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.JWT_EXPIRY,
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
        }
      );

      logger.info("[AUTH - ADMIN LOGIN] User logged in successfully");
      return res.status(200).json({
        message: "login_ok",
        success_code: "LOGIN_OK",
        payload: {
          token: token,
        },
      });
    } catch (error) {
      logger.error(
        "[AUTH -  ADMIN LOGIN] Internal server error: " + error.message
      );
      res
        .status(500)
        .json({ message: "internal_error", err_code: "INTERNAL_ERROR" });
    }
  };

  const login = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (email === undefined || password === undefined) {
        logger.warn("[AUTH - LOGIN] Invalid request");
        return res.status(400).json({
          message: "invalid_request",
          err_code: "AUTH_INVALID_REQUEST",
        });
      }

      if (typeof email !== "string" || typeof password !== "string") {
        logger.warn("[AUTH - LOGIN] Invalid request");
        return res.status(400).json({
          message: "invalid_request",
          err_code: "AUTH_INVALID_REQUEST",
        });
      }

      const isExist = await User.findOne({ email: email });
      if (!isExist) {
        logger.warn("[AUTH - LOGIN] User not found");
        return res
          .status(404)
          .json({ message: "user_not_found", err_code: "AUTH_USER_NOT_FOUND" });
      }

      const isPasswordValid = await argon2.verify(isExist.password, password);
      if (!isPasswordValid) {
        logger.warn("[AUTH - LOGIN] Invalid password");
        return res.status(404).json({
          message: "user_not_found",
          err_code: "AUTH_USER_NOT_FOUND",
        });
      }

      const role = isExist.role;
      const token = jwt.sign(
        {
          id_user: isExist._id,
          role,
          email: isExist.email,
          name: isExist.name,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.JWT_EXPIRY,
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE,
        }
      );

      logger.info("[AUTH - LOGIN] User logged in successfully");
      return res.status(200).json({
        message: "login_ok",
        success_code: "LOGIN_OK",
        payload: {
          token: token,
        },
      });
    } catch (error) {
      logger.error("[AUTH - LOGIN] Internal server error: " + error.message);
      res.status(500).json({
        message: "internal_error",
        err_code: "INTERNAL_ERROR",
      });
    }
  };

  const register = async (req, res) => {
    try {
      const { name, email, password, phone } = req.body;
      const v = validator();

      const validations = [
        v.validateName(name),
        v.validateEmail(email),
        v.validatePassword(password),
        v.validatePhone(phone),
      ];

      const failed = validations.find((val) => !val.result);
      if (failed) {
        logger.warn(
          `[AUTH - REGISTER] IP: ${req.ip} - Path: ${req.originalUrl} - Message: ${failed.message}`
        );
        return res.status(400).json({
          message: "validation_error",
          err_code: "AUTH_REG_VALIDATION_ERROR",
        });
      }

      const existingUser = await User.findOne({
        $or: [{ email }, { phone }],
      });

      if (existingUser) {
        if (existingUser.email === email) {
          logger.warn(
            `[AUTH - REGISTER] IP: ${req.ip} - Path: ${req.originalUrl} - Message: Email sudah terdaftar.`
          );
          return res.status(400).json({
            message: "email_already_registered",
            err_code: "AUTH_REG_EMAIL_ALREADY_REGISTERED",
          });
        }
        if (existingUser.phone === phone) {
          logger.warn(
            `[AUTH - REGISTER] IP: ${req.ip} - Path: ${req.originalUrl} - Message: Nomor telepon sudah terdaftar.`
          );
          return res.status(400).json({
            message: "phone_already_registered",
            err_code: "AUTH_REG_PHONE_ALREADY_REGISTERED",
          });
        }
      }

      const hashedPassword = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 2 ** 16,
        timeCost: 3,
        parallelism: 1,
      });
      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        phone,
        role: "user",
      });
      await newUser.save();
      logger.info(
        `[AUTH - REGISTER] IP: ${req.ip} - Path: ${req.originalUrl} - Message: User berhasil terdaftar.`
      );
      res.status(201).json({
        message: "registration_successful",
        success_code: "AUTH_REG_SUCCESS",
      });
    } catch (err) {
      logger.error(
        "[AUTH - REGISTER] Internal server error: " +
          err._message +
          " -> " +
          err.message
      );
      res.status(500).json({
        message: "internal_error",
        err_code: "INTERNAL_ERROR",
      });
    }
  };

  return {
    login,
    loginAdmin,
    register,
  };
};

export default authControllerBuilder;
