import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { check, validationResult } from "express-validator";
import { Pool } from "../../../config/connectDB";
import { PoolConnection, RowDataPacket,  ResultSetHeader } from "mysql2/promise";
import { TUser } from "../../models/User";

const router = express.Router();

const VALID_INVITATION_KEYS = ["YOUR_SECRET_KEY_1", "YOUR_SECRET_KEY_2"];

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
    const { email, password, username, phone_num, invitationKey }:  TUser & { invitationKey: string } = req.body;
    if (!VALID_INVITATION_KEYS.includes(invitationKey)) {
      return res.status(403).json({
        status: "fail",
        message: "Invalid invitation key. Access denied.",
      });
    }
    try {
      const [[user_existed]] = await connection.execute<RowDataPacket[]>(
        `SELECT * FROM hobit.users WHERE email = ?`,
        [email]
      );

      if (user_existed) {
        return res.status(400).json({
          status: "fail",
          message: "User already exists",
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);

      await connection.execute<ResultSetHeader>(
        `INSERT INTO hobit.users (email, password, username, phone_num) VALUES (?, ?, ? ,?)`,
        [email, hashed, username, phone_num]
      );

      const response = {
        status: "success",
        message: "User registered successfully",
      }
      res.status(201).json(response);
    } catch (err: any) {
      console.error(err.message);
      res.status(500).json({
        status: "fail",
        message: err.message,
      });
    } finally {
      connection.release();
    }
  }
);


// @route DELETE api/user/:user_id
// @desc Delete user by user_id
// @access Private
router.delete("/:user_id", async (req: Request<{ user_id: string }>, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { user_id } = req.params;
  console.log(user_id)
  try {
    await connection.execute<ResultSetHeader>(
      `DELETE FROM hobit.users WHERE id = ?`,
      [user_id]
    );
    const response = {
      status: "success",
      message: "User deleted successfully",
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



export default router;