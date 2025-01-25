import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { SpecificFrequencyRequest, SpecificFrequencyResponse } from "../../../types/questionLog";
import _ from "lodash";
import moment from "moment";

const router = express.Router();

// @route   Get api/questionlogs/frequency/:faq_id
// @desc    Get frequency of question log
// @access  Private
router.get("/frequency/:faq_id", async (req: Request<SpecificFrequencyRequest['params']>, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { faq_id } = req.params;
  const { startDate, endDate, period } = req.query as SpecificFrequencyRequest['query'];
  console.log(req.params, req.query);

  try {
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
        DATE_FORMAT(DateRange.date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(DateRange.date + INTERVAL ${intervalType} - INTERVAL 1 DAY, '%Y-%m-%d') AS endDate,
        COALESCE(COUNT(question_logs.faq_id), 0) AS count
      FROM hobit.faqs
      CROSS JOIN DateRange
      LEFT OUTER JOIN hobit.question_logs 
        ON faqs.id = question_logs.faq_id 
        AND DATE(question_logs.created_at) >= DATE_FORMAT(DateRange.date, '%Y-%m-%d')
        AND DATE(question_logs.created_at) < DATE_FORMAT(DateRange.date + INTERVAL ${intervalType}, '%Y-%m-%d')
      WHERE faqs.id = ? AND DateRange.date BETWEEN ? AND ?
      GROUP BY DateRange.date, faqs.id
      ORDER BY DateRange.date;`,
      [start_date, end_date, faq_id, start_date, end_date]
    );

    const groupbyDate = _.groupBy(dateFrequncy, "startDate");
    const logData: SpecificFrequencyResponse['data']['logData'] = {
      startDate: "",
      endDate: "",
      groupData: [],
    };
    const groupData : SpecificFrequencyResponse['data']['logData']['groupData'] = [];
    for (const date in groupbyDate) {
      const startDate = date;
      const endDate = groupbyDate[date][0].endDate;

      const data : SpecificFrequencyResponse['data']['logData']['groupData'][0]['data'] = {
        faq_id: groupbyDate[date][0].faq_id,
        question_ko: groupbyDate[date][0].question_ko,
        count: groupbyDate[date][0].count,
      };
      
      groupData.push({
        startDate: startDate,
        endDate: endDate,
        data: data,
      });
    }
    logData.startDate = start_date;
    logData.endDate = end_date;
    logData.groupData = groupData;

    const response : SpecificFrequencyResponse = {
      statusCode: 200,
      message: "Question log frequency retrieved successfully",
      data : {
        logData
      }
    };
    console.log(response);
    res.status(200).json(response);
  } catch (err: any) {
    const response = {
      statusCode : 500,
      message : err.message,
    }
    console.log(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;