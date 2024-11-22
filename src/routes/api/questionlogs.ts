import express, { Request, Response } from "express";
import { Pool } from "../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import _ from "lodash";
import moment from "moment";

const router = express.Router();

// @route   Get api/questionlogs/
// @desc    Get all question_logs
// @access  Private
router.get('/', async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();

  try {
    const [logs] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        ql.id AS question_log_id,
        ql.user_question,
        ql.feedback_score,
        ql.feedback,
        ql.created_at,
        f.id AS faq_id,
        IF (ql.language = 'ko', f.question_ko, f.question_en) AS faq_question,
        IF (ql.language = 'ko', f.maincategory_ko, f.maincategory_en) AS faq_maincategory,
        IF (ql.language = 'ko', f.subcategory_ko, f.subcategory_en) AS faq_subcategory
      FROM question_logs ql
      JOIN faqs f ON ql.faq_id = f.id`
    );
    const response = {
      status: "success",
      message: "Question logs retrieved successfully",
      data : {
        logs
      }
    }
    res.status(200).json(response);
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  } finally {
    connection.release();
  }
});

// @route   Get api/questionlogs/frequency
// @desc    Get frequency of question logs
// @access  Private
router.get("/frequency", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { startDate, endDate, period, sortOrder, limit } = req.query as {
    startDate: string;
    endDate: string;
    period: string;
    sortOrder: string;
    limit: string;
  };
  console.log(req.query);

  try {
    const sortorder = parseInt(sortOrder) ? "DESC" : "ASC";
    const start_date = moment(startDate).format("YYYY-MM-DD");
    const end_date = moment(endDate).format("YYYY-MM-DD");

    const intervalType =
      period === "day" ? "1 DAY" : period === "week" ? "1 WEEK" : "1 MONTH";
    const [dateFrequncy] = await connection.execute<RowDataPacket[]>(
      `WITH RECURSIVE DateRange AS (
        SELECT ? AS date
        UNION ALL
        SELECT DATE(date + INTERVAL ${intervalType}) 
        FROM DateRange
        WHERE date < ?
      )
      SELECT 
        faqs.id AS faq_id,
        faqs.question_ko,
        DATE_FORMAT(CONVERT_TZ(DateRange.date, '+00:00', '+09:00'), '%Y-%m-%d') AS startDate,
        DATE_FORMAT(CONVERT_TZ(DateRange.date + INTERVAL ${intervalType} - INTERVAL 1 DAY, '+00:00', '+09:00'), '%Y-%m-%d') AS endDate,
        COALESCE(COUNT(question_logs.faq_id), 0) AS count
      FROM hobit.faqs
      CROSS JOIN DateRange
      LEFT OUTER JOIN hobit.question_logs 
        ON faqs.id = question_logs.faq_id 
        AND DATE(CONVERT_TZ(question_logs.created_at, '+00:00', '+09:00')) >= DATE_FORMAT(CONVERT_TZ(DateRange.date, '+00:00', '+09:00'), '%Y-%m-%d')
        AND DATE(CONVERT_TZ(question_logs.created_at, '+00:00', '+09:00')) < DATE_FORMAT(CONVERT_TZ(DateRange.date + INTERVAL ${intervalType}, '+00:00', '+09:00'), '%Y-%m-%d')
      WHERE DateRange.date BETWEEN ? AND ?
      GROUP BY DateRange.date, faqs.id
      ORDER BY DateRange.date, count ${sortorder}, faqs.id;`,
      [start_date, end_date, start_date, end_date]
    );

    const groupbyDate = _.groupBy(dateFrequncy, "startDate");
    const logData: {
      startDate: string;
      endDate: string;
      groupData: {
        startDate: string;
        endDate: string;
        data: {
          rank: number;
          faq_id: number;
          question_ko: string;
          count: number;
        }[];
      }[];
    } = {
      startDate: "",
      endDate: "",
      groupData: [],
    };
    const groupData = [];
    for (const date in groupbyDate) {
      const startDate = date;
      const endDate = groupbyDate[date][0].endDate;

      let rank = 1;
      const data = [];
      for (const item of groupbyDate[date]) {
        data.push({
          rank: rank,
          faq_id: item.faq_id,
          question_ko: item.question_ko,
          count: item.count,
        });
        if (rank === Number(limit)) break;
        rank++;
      }
      groupData.push({
        startDate: startDate,
        endDate: endDate,
        data: data,
      });
    }
    logData.startDate = start_date;
    logData.endDate = end_date;
    logData.groupData = groupData;

    const response = {
      status: "success",
      message: "Question logs frequency retrieved successfully",
      data : {
        logData
      }
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    console.error(err.message);
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  } finally {
    connection.release();
  }
});

// @route   Get api/questionlogs/frequency
// @desc    Get average feedback score of question logs
// @access  Private
router.get("/feedback", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { startDate, endDate, period, sortOrder, limit } = req.query as {
    startDate: string;
    endDate: string;
    period: string;
    sortOrder: string;
    limit: string;
  };
  console.log(req.query);

  try {
    const sortorder = parseInt(sortOrder) ? "DESC" : "ASC";
    const start_date = moment(startDate).format("YYYY-MM-DD");
    const end_date = moment(endDate).format("YYYY-MM-DD");
    const intervalType =
      period === "day" ? "1 DAY" : period === "week" ? "1 WEEK" : "1 MONTH";

    const [feedbackData] = await connection.execute<RowDataPacket[]>(
      `WITH RECURSIVE DateRange AS (
        SELECT ? AS date
        UNION ALL
        SELECT DATE(date + INTERVAL ${intervalType}) 
        FROM DateRange
        WHERE date < ?
      )
      SELECT 
        faqs.id AS faq_id,
        faqs.question_ko,
        DATE_FORMAT(CONVERT_TZ(DateRange.date, '+00:00', '+09:00'), '%Y-%m-%d') AS startDate,
        DATE_FORMAT(CONVERT_TZ(DateRange.date + INTERVAL ${intervalType} - INTERVAL 1 DAY, '+00:00', '+09:00'), '%Y-%m-%d') AS endDate,
        COALESCE(AVG(question_logs.feedback_score), 0) AS score_average
      FROM hobit.faqs
      CROSS JOIN DateRange
      LEFT OUTER JOIN hobit.question_logs 
        ON faqs.id = question_logs.faq_id 
        AND DATE(CONVERT_TZ(question_logs.created_at, '+00:00', '+09:00')) >= DATE_FORMAT(CONVERT_TZ(DateRange.date, '+00:00', '+09:00'), '%Y-%m-%d')
        AND DATE(CONVERT_TZ(question_logs.created_at, '+00:00', '+09:00')) < DATE_FORMAT(CONVERT_TZ(DateRange.date + INTERVAL ${intervalType}, '+00:00', '+09:00'), '%Y-%m-%d')
      WHERE DateRange.date BETWEEN ? AND ?
      GROUP BY DateRange.date, faqs.id
      ORDER BY DateRange.date, score_average ${sortorder}, faqs.id;`,
      [start_date, end_date, start_date, end_date]
    );

    const groupbyDate = _.groupBy(feedbackData, "startDate");
    const logData: {
      startDate: string;
      endDate: string;
      groupData: {
        startDate: string;
        endDate: string;
        data: {
          rank: number;
          faq_id: number;
          question_ko: string;
          score_average: number;
        }[];
      }[];
    } = {
      startDate: "",
      endDate: "",
      groupData: [],
    };

    const groupData = [];
    for (const date in groupbyDate) {
      const startDate = date;
      const endDate = groupbyDate[date][0].endDate;

      let rank = 1;
      const data = [];
      for (const item of groupbyDate[date]) {
        data.push({
          rank: rank,
          faq_id: item.faq_id,
          question_ko: item.question_ko,
          score_average: parseFloat(item.score_average),
        });
        if (rank === Number(limit)) break;
        rank++;
      }
      groupData.push({
        startDate: startDate,
        endDate: endDate,
        data: data,
      });
    }
    logData.startDate = start_date;
    logData.endDate = end_date;
    logData.groupData = groupData;

    const response = {
      status: "success",
      message: "Question logs feedback score retrieved successfully",
      data : {
        logData
      }
    };
    console.log(response, 1111);
    res.status(200).json(response);
  } catch (err: any) {
    console.error("Error:", err.message);
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  } finally {
    connection.release();
  }
});

// @route   Get api/questionlogs/language
// @desc    Get frequency of question logs by language
// @access  Private
router.get("/language", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { startDate, endDate, period} = req.query as {
    startDate: string;
    endDate: string;
    period: string;
  };
  console.log(req.query);

  try {
    const start_date = moment(startDate).format("YYYY-MM-DD");
    const end_date = moment(endDate).format("YYYY-MM-DD");

    const interval =
      period === "day" ? "1 DAY" : period === "week" ? "1 WEEK" : "1 MONTH";

    const [languageFrequency] = await Pool.execute<RowDataPacket[]>(
      `WITH RECURSIVE DateRange AS (
        SELECT ? AS date
        UNION ALL
        SELECT DATE(date + INTERVAL ${interval}) 
        FROM DateRange
        WHERE date < ?
      )
      SELECT 
        DATE_FORMAT(DateRange.date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(DateRange.date + INTERVAL ${interval} - INTERVAL 1 DAY, '%Y-%m-%d') AS endDate,
        COALESCE(SUM(CASE WHEN language = 'ko' THEN 1 ELSE 0 END), 0) AS frequency_ko,
        COALESCE(SUM(CASE WHEN language = 'en' THEN 1 ELSE 0 END), 0) AS frequency_en
      FROM DateRange
      LEFT JOIN question_logs
        ON DATE(question_logs.created_at) >= DateRange.date
        AND DATE(question_logs.created_at) < DateRange.date + INTERVAL ${interval}
      WHERE DateRange.date BETWEEN ? AND ?
      GROUP BY DateRange.date
      ORDER BY DateRange.date;`,
      [start_date, end_date, start_date, end_date]
    );

    const groupbyDate = _.groupBy(languageFrequency, "startDate");
    const logData: {
      startDate: string;
      endDate: string;
      groupData: {
        startDate: string;
        endDate: string;
        data: {
          ko_frequency: number;
          en_frequency: number;
        }[];
      }[];
    } = {
      startDate: "",
      endDate: "",
      groupData: [],
    };
    const groupData = [];
    for (const date in groupbyDate) {
      const startDate = date;
      const endDate = groupbyDate[date][0].endDate;
      const ko_frequency = groupbyDate[date][0].frequency_ko;
      const en_frequency = groupbyDate[date][0].frequency_en;
      const data = [];
      data.push({
        ko_frequency: ko_frequency,
        en_frequency: en_frequency,
      });

      groupData.push({
        startDate: startDate,
        endDate: endDate,
        data: data,
      });
    }

    logData.startDate = start_date;
    logData.endDate = end_date;
    logData.groupData = groupData;

    const response = {
      status: "success",
      message: "Question logs language frequency retrieved successfully",
      data : {
        logData
      }
    };
    console.log(response.data.logData.groupData);
    res.status(200).json(response);
  } catch (err: any) {
    console.error("Error:", err.message);
    res.status(500).json({
      status: "fail",
      message: err.message,
    });
  } finally {
    connection.release();
  }
});

export default router;
