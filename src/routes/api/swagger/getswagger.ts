import express from "express";
import { swaggerDocs } from "../../../../config/swaggerConfig";

const router = express.Router();

router.get("/", (_req, res) => {
  try {
    const response = {
      statusCode: 200,
      message: "Swagger retrieved successfully",
      data: swaggerDocs,
    }
    console.log(response);
    res.status(200).json(response);
  } catch (error) {
    const response = {
      statusCode: 500,
      message: "Failed to retrieve Swagger",
    }
    console.log(response);
    res.status(500).json(response);
  }
});

export default router;
