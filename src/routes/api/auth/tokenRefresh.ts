import express, { Response } from "express";
import jwt from "jsonwebtoken";
import auth from "../../../middleware/auth";
import Payload from "../../../types/Payload";
import Request from "../../../types/Request";
import { NewAccessTokenResponse } from "../../../types/user";
import env from "../../../../config/env";

const router = express.Router();

// @route   POST api/auth/refresh
// @desc    Refresh Access Token using Refresh Token (from cookie)
// @access  Public
router.post("/refresh", auth, async (req: Request, res: Response) => {
  try {
    const existed_accessToken = req.cookies?.accessToken;
    if (existed_accessToken) {
      const response = {
        statusCode: 200,
        message: "Access token is still valid",
      }
      return res.status(200).json(response);
    }

    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      const response = {
        statusCode: 400,
        message: "No refresh token provided",
      }
      return res.status(400).json(response);
    }

    // Verify the refresh token
    const decoded: any = jwt.verify(refreshToken, env.JWT_SECRET);

    // Extract user_id from the decoded payload
    const { user_id } = decoded;

    // 새로운 payload를 생성
    const payload: Payload = { user_id };

    // 새로운 access token 생성
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRATION,
    });

    // 쿠키에 새로운 access token 저장
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: Number(env.JWT_EXPIRATION) * 1000,
    });

    // 성공 응답
    const response: NewAccessTokenResponse = {
      statusCode: 200,
      message: "Access token refreshed successfully",
    };
    
    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    };
    res.status(500).json(response);
  }
});

export default router;
