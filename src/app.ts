import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import env from "../config/env";
import { initializeDatabase } from "../config/createDB";
import { startCronJobs } from "./scripts/cronJobs";

// 라우트 임포트
import authRoutes from "./routes/api/auth/authIndex";
import usersRoutes from "./routes/api/users/usersIndex";
import faqsRoutes from "./routes/api/faqs/faqsIndex";
import seniorfaqsRoutes from "./routes/api/seniorfaqs/seniorfaqsIndex";
import adminlogsRoutes from "./routes/api/adminlogs/adminlogsIndex";
import questionlogsRoutes from "./routes/api/questionlogs/questionlogsIndex";
import feedbacksRoutes from "./routes/api/feedbacks/feedbacksIndex";
import translateRoutes from "./routes/api/translate/translateIndex";
import swaggerRoutes from "./routes/api/swagger/swaggerIndex";
import bulkUpdateEmailRoutes from "./routes/api/emails/bulkUpdateEmail";
import getAllEmailsRoutes from "./routes/api/emails/getAllEmails";
import bulkDeleteEmailRoutes from "./routes/api/emails/bulkDeleteEmail";
import bulkUpdateAdminRoutes from "./routes/api/admins/bulkUpdateAdmin";
import getAllAdminsRoutes from "./routes/api/admins/getAllAdmins";
import bulkDeleteAdminRoutes from "./routes/api/admins/bulkDeleteAdmin";
import bulkDeleteFeedbacksRoutes from "./routes/api/feedbacks/bulkDeleteFeedbacks";
import countFeedbacksRoutes from "./routes/api/feedbacks/countFeedbacks";
import bulkDeleteAdminLogsRoutes from "./routes/api/adminlogs/bulkDeleteAdminLogs";
import countAdminLogsRoutes from "./routes/api/adminlogs/countAdminLogs";
import bulkDeleteQuestionLogsRoutes from "./routes/api/questionlogs/bulkDeleteQuestionLogs";
import countQuestionLogsRoutes from "./routes/api/questionlogs/countQuestionLogs";

const app = express();


// CORS 설정 수정 (쿠키 인증 허용)
app.use(
  cors({
    origin: [
      env.CLIENT_URL1,
      env.CLIENT_URL2,
      "https://admin.hobit.kr",
      /^https:\/\/.*\.vercel\.app$/,
    ],
    credentials: true
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
app.use("/api", swaggerRoutes);
app.use("/api/emails/bulk-update", bulkUpdateEmailRoutes);
app.use("/api/emails", getAllEmailsRoutes);
app.use("/api/emails/bulk-delete", bulkDeleteEmailRoutes);
app.use("/api/admins/bulk-update", bulkUpdateAdminRoutes);
app.use("/api/admins", getAllAdminsRoutes);
app.use("/api/admins/bulk-delete", bulkDeleteAdminRoutes);
app.use("/api/feedbacks/bulk-delete", bulkDeleteFeedbacksRoutes);
app.use("/api/feedbacks/count", countFeedbacksRoutes);
app.use("/api/adminlogs/bulk-delete", bulkDeleteAdminLogsRoutes);
app.use("/api/adminlogs/count", countAdminLogsRoutes);
app.use("/api/questionlogs/bulk-delete", bulkDeleteQuestionLogsRoutes);
app.use("/api/questionlogs/count", countQuestionLogsRoutes);

// 자동실행 스크립트
startCronJobs();

export default app;
