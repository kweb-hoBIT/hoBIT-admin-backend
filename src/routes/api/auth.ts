import express, { Response } from "express";
import bcrypt from "bcryptjs";
import config from "config";
import { check, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import auth from "../../middleware/auth";
import Payload from "../../types/Payload";
import Request from "../../types/Request";
import { Pool } from "../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";


const router = express.Router();


// @route   GET api/auth
// @desc    Get authenticated user given the token
// @access  Private
router.get("/", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id }: { user_id: number } = req;

  try {
    const [[user]] = await connection.execute<RowDataPacket[]>(
      `SELECT id, email, username, phone_num, created_at, updated_at FROM hobit.users WHERE id = ?`,
      [user_id]
    );

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    const response = {
      status: "success",
      message: "User data retrieved successfully",
      data: {
        user,
      },
    };

    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  } finally {
    connection.release();
  }
});

// @route   POST api/auth
// @desc    Login user and get token
// @access  Public
router.post(
  "/",
  [
    check("email", "Please include a valid email").isEmail(),
    check("password", "Password is required").exists(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ errors: errors.array() });
    }
    const connection = await Pool.getConnection();
    const { email, password } : { email: string, password: string}= req.body;
    console.log(email, password);
    try {
      const [[user]] = await connection.execute<RowDataPacket[]>(
        `SELECT * FROM hobit.users WHERE email = ?`,
        [email]
      );

      if (!user) {
        return res.status(404).json({
          status: "fail",
          message: "User not found",
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({
          status: "fail",
          message: "Invalid Credentials",
        });
      }

      if (user.status === "pending") {
        return res.status(403).json({
          status: "fail",
          message: "User registration is pending approval",
        });
      }

      const payload: Payload = {
        user_id: user.id,
      };

      jwt.sign(
        payload,
        config.get("jwtSecret"),
        { expiresIn: config.get("jwtExpiration") },
        (err, token) => {
          if (err) throw err;
          const response = {
            status: "success",
            message: "Authentication successful",
            data: {
              token
            }
          }
          res.json(response);
        }
      );
    } catch (err: any) {
      console.error(err.message);
      res.status(500).json({
        status: "fail",
        message: err.message
      });
    } finally {
      connection.release();
    }
  }
);

export default router;