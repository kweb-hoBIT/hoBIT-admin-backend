import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import env from "../config/env";
import { initializeDatabase } from "../config/createDB";

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

// CORS 설정 수정 (쿠키 인증 허용)
const corsOptions = {
  origin: [
    env.CLIENT_URL1,
    env.CLIENT_URL2,
    "https://hobit-admin-frontend.vercel.app",
    "https://hobit-admin-frontend-preview.vercel.app",
    "https://admin.hobit.kr"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // OPTIONS 허용
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));

// 미들웨어 설정
app.use(cookieParser());
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

// JWT 리프레시 토큰 엔드포인트 추가
app.post("/api/auth/refresh", (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  jwt.verify(refreshToken, env.JWT_SECRET, (err: jwt.VerifyErrors | null, decoded: JwtPayload | undefined) => {
    if (err) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    if (!decoded || !decoded.userId) {
      return res.status(403).json({ message: "Invalid token payload" });
    }

    const newAccessToken = jwt.sign({ userId: decoded.userId }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRATION || "1h",
    });

    res.json({ accessToken: newAccessToken });
  });
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
