import env from "../../config/env";
import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import Payload from "../types/Payload";
import Request from "../types/Request";

export default function(req: Request, res: Response, next: NextFunction) {
  // Get token from header
  const accessToken = req.cookies?.accessToken;
  // Check if no token
  if (!accessToken) {
    return res
      .status(401)
      .json({ msg: "No token, authorization denied" });
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
