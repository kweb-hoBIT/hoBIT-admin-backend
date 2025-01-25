import bodyParser from "body-parser";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import env from "../config/env";
import { initializeDatabase } from '../config/createDB';

import authRoutes from "./routes/api/auth/authIndex";
import usersRoutes from "./routes/api/users/usersIndex";
import faqsRoutes from "./routes/api/faqs/faqsIndex";
import seniorfaqsRoutes from "./routes/api/seniorfaqs/seniorfaqsIndex";
import adminlogsRoutes from "./routes/api/adminlogs/adminlogsIndex";
import questionlogsRoutes from "./routes/api/questionlogs/questionlogsIndex";
import feedbacksRoutes from "./routes/api/feedbacks/feedbacksIndex";
import translateRoutes from "./routes/api/translate/translateIndex";


const app = express();

const corsOptions = {
  origin: [
    env.CLIENT_URL, "http://localhost:3001", "http://localhost:3000"
  ],
  credentials: true,
};

 // CORS 미들웨어
app.use(cors(corsOptions));

// 쿠키 파서 미들웨어
app.use(cookieParser());

// Body parser 미들웨어
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

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

// 라우트 설정
app.use("/api", authRoutes);
app.use("/api", usersRoutes);
app.use("/api", faqsRoutes);
app.use("/api", seniorfaqsRoutes);
app.use("/api", adminlogsRoutes);
app.use("/api", questionlogsRoutes);
app.use("/api", feedbacksRoutes);
app.use("/api", translateRoutes);

// 서버 포트 설정 및 시작
app.set("port", env.PORT || 5001);
const port = app.get("port");
const server = app.listen(port, () =>
  console.log(`Server started on port ${port}`)
);

export default server;
