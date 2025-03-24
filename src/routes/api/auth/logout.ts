import express, { Response } from "express";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   POST api/auth/logout
// @desc    Logout user and clear tokens
// @access  Public
router.post("/logout", auth, (req: Request, res: Response) => {
  try {
    res.clearCookie("accessToken", {
      httpOnly: false, 
      secure: true, 
      sameSite: "strict",
    });
    
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true, 
      sameSite: "strict",
    });
    
    const response = {
      statusCode: 200,
      message: "Logout successful",
    }
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