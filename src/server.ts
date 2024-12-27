import bodyParser from "body-parser";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initializeDatabase } from '../config/createDB';

import authRoutes from "./routes/api/auth/authIndex";
import usersRoutes from "./routes/api/users/usersIndex";
import faqsRoutes from "./routes/api/faqs/faqsIndex";
import faqlogsRoutes from "./routes/api/faqlogs/faqlogsIndex";
import questionlogsRoutes from "./routes/api/questionlogs/questionlogsIndex";

const app = express();

// CORS 설정
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:3000", // 클라이언트 도메인으로 설정
  credentials: true, // 쿠키를 포함한 요청을 허용
};

app.use(cors(corsOptions)); // CORS 미들웨어

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
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/faqs", faqsRoutes);
app.use("/api/faqlogs", faqlogsRoutes);
app.use("/api/questionlogs", questionlogsRoutes);

// 서버 포트 설정 및 시작
app.set("port", process.env.PORT || 5000);
const port = app.get("port");
const server = app.listen(port, () =>
  console.log(`Server started on port ${port}`)
);

export default server;
