import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import env from "../config/env";
import { initializeDatabase } from "../config/createDB";

// Swagger 설정 추가
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

// 라우트 임포트
import authRoutes from "./routes/api/auth/authIndex";
import usersRoutes from "./routes/api/users/usersIndex";
import faqsRoutes from "./routes/api/faqs/faqsIndex";
import seniorfaqsRoutes from "./routes/api/seniorfaqs/seniorfaqsIndex";
import adminlogsRoutes from "./routes/api/adminlogs/adminlogsIndex";
import questionlogsRoutes from "./routes/api/questionlogs/questionlogsIndex";
import feedbacksRoutes from "./routes/api/feedbacks/feedbacksIndex";
import translateRoutes from "./routes/api/translate/translateIndex";

const app = express();

// Swagger 설정
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Hobit Admin API",
      version: "0.1.0",
      description: "HoBIT Admin API Docs",
    },
  },
  apis: ["./src/docs/swaggerDocs.yaml"], // Swagger YAML 문서 경로
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// CORS 설정 수정 (쿠키 인증 허용)
app.use(
  cors({
    origin: [
      env.CLIENT_URL1,
      env.CLIENT_URL2,
      "https://admin.hobit.kr",
      /^https:\/\/.*\.vercel\.app$/,
    ],
    credentials: true,
  })
);

// 비동기적으로 DB 초기화
(async () => {
  try {
    await initializeDatabase();
    console.log("Database initialized");
  } catch (err) {
    console.error("Error initializing database", err);
  }
})();

// 기본 라우트
app.get("/", (_req, res) => {
  res.send("API Running");
});

// Swagger UI 설정
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// 미들웨어 설정
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 라우트 설정
app.use("/api", authRoutes);
app.use("/api", usersRoutes);
app.use("/api", faqsRoutes);
app.use("/api", seniorfaqsRoutes);
app.use("/api", adminlogsRoutes);
app.use("/api", questionlogsRoutes);
app.use("/api", feedbacksRoutes);
app.use("/api", translateRoutes);

export default app;
