import express, { Response } from "express";
import bcrypt from "bcryptjs";
import config from "config";
import { check, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import Payload from "../../types/Payload";
import Request from "../../types/Request";
import { Pool } from "../../../config/connectDB";
import { PoolConnection, RowDataPacket,  ResultSetHeader } from "mysql2/promise";
import { TUser } from "../../models/User";

const router = express.Router();

// @route   POST api/user
// @desc    Register user given their email and password, returns the token upon successful registration
// @access  Public
router.post(
  "/",
  [
    check("email", "Please include a valid email").isEmail(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ errors: errors.array() });
    }
    const connection: PoolConnection = await Pool.getConnection();
    const { email, password, username, phone_num }: TUser = req.body;
    try {
      const [[user_existed]] = await connection.query<RowDataPacket[] & TUser[]>(
        `SELECT * FROM users WHERE email = ?`,
        [email]
      );

      if (user_existed) {
        return res.status(400).json({
          errors: [
            {
              msg: "User already exists",
            },
          ],
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);


      const [user] = await connection.query<ResultSetHeader>(
        `INSERT INTO users (email, password, username, phone_num, created_at, updated_at) VALUES (?, ?, ? ,?, NOW(), NOW())`,
        [email, hashed, username, phone_num]
      );

      const payload: Payload = {
        user_id: user.insertId,
      };

      jwt.sign(
        payload,
        config.get("jwtSecret"),
        { expiresIn: config.get("jwtExpiration") },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err: any) {
      console.error(err.message);
      res.status(500).json({ error: err.message });
    } finally {
      connection.release();
    }
  }
);

export default router;