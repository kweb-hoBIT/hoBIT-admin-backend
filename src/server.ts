import bodyParser from "body-parser";
import express from "express";
import cors from "cors";
import { initializeDatabase } from '../config/createDB';

import authRoutes from "./routes/api/auth";
import usersRoutes from "./routes/api/users";
import faqsRoutes from "./routes/api/faqs";
import logsRoutes from "./routes/api/logs";
import translateRoutes from "./routes/api/translate";

const app = express();
app.use(cors());

(async () => {
  await initializeDatabase();
})();

// Express configuration
app.set("port", process.env.PORT || 5000);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));



// @route   GET /
// @desc    Test Base API
// @access  Public
app.get("/", (_req, res) => {
  res.send("API Running");
});

const port = app.get("port");
const server = app.listen(port, () =>
  console.log(`Server started on port ${port}`)
);

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/faqs", faqsRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/translate", translateRoutes);

export default server;
