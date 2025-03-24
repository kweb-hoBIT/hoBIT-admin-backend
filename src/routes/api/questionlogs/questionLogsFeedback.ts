import express, { Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { EntireFeedbackRequest, EntireFeedbackResponse } from "../../../types/questionLog";
import _ from "lodash";
import moment from "moment";
import Request from "../../../types/Request";
import auth from "../../../middleware/auth";

const router = express.Router();

// @route   Get api/questionlogs/frequency
// @desc    Get average feedback score of question logs
// @access  Private
router.get("/feedback", auth, async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { startDate, endDate, period, sortOrder, limit } = req.query as EntireFeedbackRequest['query'];
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
        DATE_FORMAT(DateRange.date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(DateRange.date + INTERVAL ${intervalType} - INTERVAL 1 DAY, '%Y-%m-%d') AS endDate,
        COALESCE(AVG(question_logs.feedback_score), 0) AS score_average,
        COUNT(CASE WHEN question_logs.feedback_score = 1 THEN 1 END) AS score_like_count,
        COUNT(CASE WHEN question_logs.feedback_score = -1 THEN 1 END) AS score_dislike_count
      FROM hobit.faqs
      CROSS JOIN DateRange
      LEFT OUTER JOIN hobit.question_logs 
        ON faqs.id = question_logs.faq_id 
        AND DATE(question_logs.created_at) >= DATE_FORMAT(DateRange.date, '%Y-%m-%d')
        AND DATE(question_logs.created_at) < DATE_FORMAT(DateRange.date + INTERVAL ${intervalType}, '%Y-%m-%d')
      WHERE DateRange.date BETWEEN ? AND ?
      GROUP BY DateRange.date, faqs.id
      ORDER BY DateRange.date, score_average ${sortorder}, faqs.id;`,
      [start_date, end_date, start_date, end_date]
    );

    const groupbyDate = _.groupBy(feedbackData, "startDate");
    const logData: EntireFeedbackResponse['data']['logData'] = {
      startDate: "",
      endDate: "",
      groupData: [],
    };

    const groupData : EntireFeedbackResponse['data']['logData']['groupData'] = [];
    for (const date in groupbyDate) {
      const startDate = date;
      const endDate = groupbyDate[date][0].endDate;

      let rank = 1;
      const data : EntireFeedbackResponse['data']['logData']['groupData'][0]['data'] = [];
      for (const item of groupbyDate[date]) {
        data.push({
          rank: rank,
          faq_id: item.faq_id,
          question_ko: item.question_ko,
          score_average: parseFloat(item.score_average),
          score_like_count: item.score_like_count,
          score_dislike_count: item.score_dislike_count
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

    const response : EntireFeedbackResponse = {
      statusCode: 200,
      message: "Question logs feedback score retrieved successfully",
      data : {
        logData
      }
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    }
    console.log(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;