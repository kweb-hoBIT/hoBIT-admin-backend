import express, { Request, Response } from "express";
import { Pool } from "../../../config/connectDB";
import {
  addMonths,
  addDays,
  startOfWeek,
  startOfMonth,
  endOfWeek,
  endOfMonth,
} from "date-fns";

const router = express.Router();

router.get("/", async (req: Request, res: Response) => {
  const { startDate, endDate, period, sortOrder, limit } = req.query;

  res.json({
    startDate,
    endDate,
    period,
    sortOrder,
    limit,
  });
});

router.get("/frequency", async (req: Request, res: Response) => {
  const { startDate, endDate, period, sortOrder, limit } = req.query;

  if (!startDate || !endDate || !period) {
    return res
      .status(400)
      .json({ error: "startDate, endDate, and period are required" });
  }

  if (period !== "week" && period !== "month") {
    return res
      .status(400)
      .json({ error: "Invalid period value. Use 'week' or 'month'." });
  }

  try {
    const interval = period === "week" ? "WEEK" : "MONTH";

    const query = `
      SELECT 
        ${interval}(created_at) AS period_number,
        faq_id,
        user_question,
        COUNT(*) AS frequency,
        MIN(created_at) AS period_start_date
      FROM question_logs
      WHERE created_at BETWEEN ? AND ?
      GROUP BY period_number, faq_id, user_question
      ORDER BY period_number, frequency ${sortOrder === "1" ? "ASC" : "DESC"}
    `;

    const [rows]: any = await Pool.execute(query, [startDate, endDate]);

    // Group records by month or week and calculate correct date ranges
    const groupedData: Record<
      string,
      { faq_id: number; user_question: string; frequency: number }[]
    > = {};

    // Iterate over each month between startDate and endDate
    let currentStart = new Date(startDate as string);
    const end = new Date(endDate as string);

    while (currentStart <= end) {
      let startOfPeriod, endOfPeriod;

      if (period === "week") {
        startOfPeriod = startOfWeek(currentStart);
        endOfPeriod = endOfWeek(currentStart);
      } else {
        startOfPeriod = startOfMonth(currentStart);
        endOfPeriod = endOfMonth(currentStart);
      }

      // Format the period range
      const periodRange = `${startOfPeriod.toISOString().split("T")[0]} ~ ${
        endOfPeriod.toISOString().split("T")[0]
      }`;
      groupedData[periodRange] = [];

      // Filter rows that fall within the current period
      rows.forEach((row: any) => {
        const rowDate = new Date(row.period_start_date);
        if (rowDate >= startOfPeriod && rowDate <= endOfPeriod) {
          groupedData[periodRange].push({
            faq_id: row.faq_id,
            user_question: row.user_question,
            frequency: row.frequency,
          });
        }
      });

      // Apply sorting and limit to the current period
      groupedData[periodRange] = groupedData[periodRange]
        .sort((a, b) =>
          sortOrder === "1"
            ? a.frequency - b.frequency
            : b.frequency - a.frequency
        )
        .slice(0, parseInt(limit as string, 10));

      // Move to the next period
      currentStart =
        period === "week"
          ? addDays(currentStart, 7)
          : addMonths(currentStart, 1);
    }

    res.json({
      data: groupedData,
      parameters: {
        startDate,
        endDate,
        period,
        sortOrder,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching data from question_logs:", error);
    res
      .status(500)
      .json({ error: "Failed to retrieve data from question_logs" });
  }
});

router.get("/feedback", async (req: Request, res: Response) => {
  const { startDate, endDate, period, sortOrder, limit } = req.query;

  if (!startDate || !endDate || !period) {
    return res
      .status(400)
      .json({ error: "startDate, endDate, and period are required" });
  }

  if (period !== "week" && period !== "month") {
    return res
      .status(400)
      .json({ error: "Invalid period value. Use 'week' or 'month'." });
  }

  try {
    const query = `
      SELECT 
        created_at,
        faq_id, 
        user_question, 
        language, 
        AVG(feedback_score) AS avg_feedback_score,
        COUNT(*) AS frequency
      FROM question_logs
      WHERE created_at BETWEEN ? AND ?
      GROUP BY faq_id, user_question, language, created_at
    `;

    const [rows]: any = await Pool.execute(query, [startDate, endDate]);

    const groupedData: Record<string, any[]> = {};
    let currentStart = new Date(startDate as string);
    const end = new Date(endDate as string);

    // Iterate through each period (month or week)
    while (currentStart <= end) {
      let startOfPeriod, endOfPeriod;

      // Determine the start and end dates of the period
      if (period === "week") {
        startOfPeriod = startOfWeek(currentStart);
        endOfPeriod = endOfWeek(currentStart);
      } else {
        startOfPeriod = startOfMonth(currentStart);
        endOfPeriod = endOfMonth(currentStart);
      }

      const periodRange = `${startOfPeriod.toISOString().split("T")[0]} ~ ${
        endOfPeriod.toISOString().split("T")[0]
      }`;
      groupedData[periodRange] = [];

      // Add records to the current period if they fall within the period range
      rows.forEach((row: any) => {
        const rowDate = new Date(row.created_at);
        if (rowDate >= startOfPeriod && rowDate <= endOfPeriod) {
          groupedData[periodRange].push({
            faq_id: row.faq_id,
            user_question: row.user_question,
            language: row.language,
            avg_feedback_score: parseFloat(row.avg_feedback_score).toFixed(4),
            frequency: row.frequency,
          });
        }
      });

      // Sort by avg_feedback_score based on sortOrder
      groupedData[periodRange].sort((a, b) =>
        sortOrder === "1"
          ? parseFloat(a.avg_feedback_score) - parseFloat(b.avg_feedback_score)
          : parseFloat(b.avg_feedback_score) - parseFloat(a.avg_feedback_score)
      );

      // Apply limit if provided
      groupedData[periodRange] = limit
        ? groupedData[periodRange].slice(0, parseInt(limit as string, 10))
        : groupedData[periodRange];

      // Move to the next period
      currentStart =
        period === "week"
          ? addDays(currentStart, 7)
          : addMonths(currentStart, 1);
    }

    res.json({
      data: groupedData,
      parameters: {
        startDate,
        endDate,
        period,
        sortOrder,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching data from question_logs:", error);
    res
      .status(500)
      .json({ error: "Failed to retrieve data from question_logs" });
  }
});

router.get("/language", async (req: Request, res: Response) => {
  const { startDate, endDate, period } = req.query;

  if (!startDate || !endDate || !period) {
    return res
      .status(400)
      .json({ error: "startDate, endDate, and period are required" });
  }

  if (period !== "week" && period !== "month") {
    return res
      .status(400)
      .json({ error: "Invalid period value. Use 'week' or 'month'." });
  }

  try {
    const interval = period === "week" ? "WEEK" : "MONTH";

    const query = `
      SELECT 
        created_at,
        ${interval}(created_at) AS period_number,
        language,
        COUNT(*) AS frequency
      FROM question_logs
      WHERE created_at BETWEEN ? AND ?
      GROUP BY period_number, language, created_at
      ORDER BY period_number
    `;

    const [rows]: any = await Pool.execute(query, [startDate, endDate]);

    const groupedData: Record<string, any> = {};
    let currentStart = new Date(startDate as string);
    const end = new Date(endDate as string);

    while (currentStart <= end) {
      let nextStart;
      const periodRange =
        period === "week"
          ? `${currentStart.toISOString().split("T")[0]} ~ ${
              addDays(currentStart, 6).toISOString().split("T")[0]
            }`
          : `${currentStart.toISOString().split("T")[0]} ~ ${
              endOfMonth(currentStart).toISOString().split("T")[0]
            }`;

      if (period === "week") {
        nextStart = addDays(currentStart, 7);
      } else {
        nextStart = addDays(currentStart, 30);
      }

      groupedData[periodRange] = { frequency_ko: 0, frequency_en: 0 };

      rows.forEach((row: any) => {
        const rowDate = new Date(row.created_at);
        if (rowDate >= currentStart && rowDate < nextStart) {
          if (row.language === "ko") {
            groupedData[periodRange].frequency_ko += row.frequency;
          } else if (row.language === "en") {
            groupedData[periodRange].frequency_en += row.frequency;
          }
        }
      });

      currentStart = nextStart;
    }

    res.json({
      data: groupedData,
      parameters: {
        startDate,
        endDate,
        period,
      },
    });
  } catch (error) {
    console.error("Error fetching language frequency data:", error);
    res
      .status(500)
      .json({ error: "Failed to retrieve data from question_logs" });
  }
});

export default router;
