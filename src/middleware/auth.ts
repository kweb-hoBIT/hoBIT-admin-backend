import env from "../../config/env";
import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import Payload from "../types/Payload";
import Request from "../types/Request";

export default function(req: Request, res: Response, next: NextFunction) {
  // Get token from header
  let accessToken = req.cookies?.accessToken;
  const refreshToken = req.cookies?.refreshToken;
  // Check if no token
  if (!accessToken) {
    if (!refreshToken) {
      return res
      .status(401)
      .json({ msg: "No token, authorization denied" });
    }
    const decoded: any = jwt.verify(refreshToken, env.JWT_SECRET);

    // Extract user_id from the decoded payload
    const { user_id } = decoded;

    // 새로운 payload를 생성
    const payload: Payload = { user_id };

    // 새로운 access token 생성
    accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRATION,
    });
  }
  // Verify token
  try {
    const payload: Payload | any = jwt.verify(accessToken, env.JWT_SECRET);
    req.user_id = payload.user_id;
    next();
  } catch (err) {
    res
      .status(401)
      .json({ msg: "Token is not valid" });
  }
}
