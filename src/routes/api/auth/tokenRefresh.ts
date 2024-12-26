import express, { Response } from "express";
import config from "config";
import jwt from "jsonwebtoken";
import Payload from "../../../types/Payload";
import Request from "../../../types/Request";
import { RefreshTokenRequest, RefreshTokenResponse } from "../../../types/user";

const router = express.Router();


// @route   POST api/auth/refresh
// @desc    Refresh Access Token using Refresh Token
// @access  Public
router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    const response = {
      statusCode : 400,
      message: "No refresh token provided"
    }
    return res.status(400).json(response);
  }

  try {
    const decoded: any = jwt.verify(refreshToken, config.get("jwtSecret"));

    // Extract user_id from the decoded payload
    const { user_id } = decoded;

    const payload: Payload = { user_id };

    const accessToken = jwt.sign(payload, config.get("jwtSecret"), {
      expiresIn: config.get("jwtExpiration"),
    });
  
    const response : RefreshTokenResponse = {
      statusCode: 200,
      message: "Access token refreshed",
      data: {
        accessToken,
      },
    };
    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 401,
      message: "Invalid refresh token",
    }
    res.status(401).json(response);
  }
});

export default router;
