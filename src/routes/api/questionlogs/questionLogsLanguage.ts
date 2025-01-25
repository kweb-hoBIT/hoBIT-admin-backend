import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { EntireLanguageRequest, EntireLanguageResponse } from "../../../types/questionLog";
import _ from "lodash";
import moment from "moment";

const router = express.Router();

// @route   Get api/questionlogs/language
// @desc    Get frequency of question logs by language
// @access  Private
router.get("/language", async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  const { startDate, endDate, period} = req.query as EntireLanguageRequest['query'];
  console.log(req.query);

  try {
    const start_date = moment(startDate).format("YYYY-MM-DD");
    const end_date = moment(endDate).format("YYYY-MM-DD");

    const intervalType =
      period === "day" ? "1 DAY" : period === "week" ? "1 WEEK" : "1 MONTH";

    const [languageFrequency] = await Pool.execute<RowDataPacket[]>(
      `WITH RECURSIVE DateRange AS (
        SELECT ? AS date
        UNION ALL
        SELECT DATE(date + INTERVAL ${intervalType}) 
        FROM DateRange
        WHERE date < ?
      )
      SELECT 
        DATE_FORMAT(DateRange.date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(DateRange.date + INTERVAL ${intervalType} - INTERVAL 1 DAY, '%Y-%m-%d') AS endDate,
        COALESCE(SUM(CASE WHEN language = 'KO' THEN 1 ELSE 0 END), 0) AS frequency_ko,
        COALESCE(SUM(CASE WHEN language = 'EN' THEN 1 ELSE 0 END), 0) AS frequency_en
      FROM DateRange
      LEFT JOIN question_logs
        ON DATE(question_logs.created_at) >= DateRange.date
        AND DATE(question_logs.created_at) < DateRange.date + INTERVAL ${intervalType}
      WHERE DateRange.date BETWEEN ? AND ?
      GROUP BY DateRange.date
      ORDER BY DateRange.date;`,
      [start_date, end_date, start_date, end_date]
    );

    const groupbyDate = _.groupBy(languageFrequency, "startDate");
    const logData : EntireLanguageResponse['data']['logData'] = {
      startDate: "",
      endDate: "",
      groupData: [],
    };
    const groupData :  EntireLanguageResponse['data']['logData']['groupData'] = [];
    for (const date in groupbyDate) {
      const startDate = date;
      const endDate = groupbyDate[date][0].endDate;
      const ko_frequency = groupbyDate[date][0].frequency_ko;
      const en_frequency = groupbyDate[date][0].frequency_en;
      const data : EntireLanguageResponse['data']['logData']['groupData'][0]['data'] = [];
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
      statusCode: 200,
      message: "Question logs language frequency retrieved successfully",
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
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;