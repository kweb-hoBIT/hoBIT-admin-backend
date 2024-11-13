import express, { Request, Response } from "express";
import { Pool } from "../../../config/connectDB";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import _ from 'lodash';
import moment from 'moment';
import { addDays, addMonths, endOfMonth, endOfWeek, startOfWeek, startOfMonth } from "date-fns";

const router = express.Router();



// 로그 가져오기 API
router.get('/question', async (req: Request, res: Response) => {
  const lang = req.query.lang || 'en'; // 기본 언어는 영어로 설정
  // MySQL 연결 풀에서 연결을 가져옴
  const connection: PoolConnection = await Pool.getConnection();

  try {
    // SQL 쿼리 작성/실행 (lang을 고정으로 두고 문제를 확인)
    const query = `
      SELECT 
        ql.id AS question_log_id,
        ql.user_question,
        ql.feedback_score,
        ql.feedback,
        ql.created_at,
        f.id AS faq_id,
        f.maincategory_${lang} AS faq_main,  -- lang에 맞춰서 동적으로 컬럼 선택
        f.subcategory_${lang} AS faq_sub,
        f.question_${lang} AS faq_question
      FROM question_logs ql
      JOIN faqs f ON ql.faq_id = f.id
    `;
    
    // 쿼리 실행
    const [rows] = await connection.execute(query);

    // 로그가 존재하지 않으면 빈 배열로 반환
    // if (rows.length === 0) {
    //   return res.status(404).json({ message: 'No logs found' });
    // }

    console.log('Rows:', rows);  // 쿼리 결과를 출력하여 확인


    // 응답 반환
    res.status(200).json({ logs: rows });

  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    // 연결 반환 (finally에서 항상 실행되도록)
    if (connection) {
      connection.release();
    }
  }
});



router.get("/frequency", async (req: Request, res: Response) => {
  const connection : PoolConnection= await Pool.getConnection();
  const { startDate, endDate, period, sortOrder, limit } = req.query;
  console.log(req.query);

  try {
    const sortorder = sortOrder ? "DESC" : 'ASC';
    const start_date = moment(String(startDate)).format('YYYY-MM-DD');
    const end_date = moment(String(endDate)).format('YYYY-MM-DD');

    const intervalType = period === 'day' ? '1 DAY' : period === 'week' ? '1 WEEK' : '1 MONTH';
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
      WHERE DATE_FORMAT(CONVERT_TZ(DateRange.date + INTERVAL ${intervalType} - INTERVAL 1 DAY, '+00:00', '+09:00'), '%Y-%m-%d') <= ?
      GROUP BY DateRange.date, faqs.id
      ORDER BY DateRange.date, count ${sortorder}, faqs.id;`,
      [start_date, end_date, end_date]
    );

    const groupbyDate = _.groupBy(dateFrequncy, 'startDate');
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
      startDate: '', 
      endDate: '', 
      groupData: [] 
    };
    const groupData = [];
    for(const date in groupbyDate) {
      const startDate = date;
      const endDate = groupbyDate[date][0].endDate;
      
      let rank = 1;
      const data = [];
      for(const item of groupbyDate[date]) {
        data.push({
          rank: rank,
          faq_id: item.faq_id,
          question_ko: item.question_ko,
          count: item.count
        });
        if(rank === Number(limit)) break;
        rank++;
      }
      groupData.push({
        startDate: startDate,
        endDate: endDate,
        data: data
      });
    }
    logData.startDate = start_date;
    logData.endDate = end_date;
    logData.groupData = groupData;

      
    res.status(200).json({ logData });
  } catch (err: any) {
    console.error(err.message);
    res.status(400).json({ error: err.message });
  } finally {
    connection.release();
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
