import config from "config";
import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import Payload from "../types/Payload";
import Request from "../types/Request";

export default function(req: Request, res: Response, next: NextFunction) {
  // Get token from header
  const token = req.header("Authorization")?.replace("Bearer ", ""); // token Authorization header에서 가져오기 (Bearer 제거)

  // Check if no token
  if (!token) {
    return res
      .status(401)
      .json({ msg: "No token, authorization denied" });
  }
  // Verify token
  try {
    const payload: Payload | any = jwt.verify(token, config.get("jwtSecret"));
    req.user_id = payload.user_id;
    next();
  } catch (err) {
    res
      .status(401)
      .json({ msg: "Token is not valid" });
  }
}
