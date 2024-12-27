import express, { Response } from "express";
import config from "config";
import jwt from "jsonwebtoken";
import Payload from "../../../types/Payload";
import Request from "../../../types/Request";
import { NewAccessTokenResponse } from "../../../types/user";

const router = express.Router();

// @route   POST api/auth/refresh
// @desc    Refresh Access Token using Refresh Token (from cookie)
// @access  Public
router.post("/refresh", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    const response = {
      statusCode: 400,
      message: "No refresh token provided",
    }
    return res.status(400).json(response);
  }
  try {
    // Verify the refresh token
    const decoded: any = jwt.verify(refreshToken, config.get("jwtSecret"));

    // Extract user_id from the decoded payload
    const { user_id } = decoded;

    // 새로운 payload를 생성
    const payload: Payload = { user_id };

    // 새로운 access token 생성
    const accessToken = jwt.sign(payload, config.get("jwtSecret"), {
      expiresIn: config.get("jwtExpiration"),
    });

    // Access Token을 쿠키로 설정 (클라이언트에서 읽을 수 있도록)
    res.cookie("accessToken", accessToken, {
      httpOnly: false,
      secure: true,
      sameSite: "strict",
      maxAge: Number(config.get("jwtExpiration")) * 1000,
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
