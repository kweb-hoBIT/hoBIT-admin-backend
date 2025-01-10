import express, { Request, Response } from "express";
import { Pool } from "../../../../config/connectDB";
import { PoolConnection } from "mysql2/promise";
import { UploadSeniorFAQImageResponse } from '../../../types/seniorfaq';

import { S3Client } from "@aws-sdk/client-s3";
import multer from 'multer';
import multerS3 from 'multer-s3';

// S3Client를 사용하여 AWS S3 인스턴스 생성 (AWS SDK v3)
const s3Client = new S3Client({
  region: "us-west-2", // 지역에 맞는 설정을 입력
});

const upload = multer({
  storage: multerS3({
    s3: s3Client, // S3Client 사용
    bucket: 'your-bucket-name',
    acl: 'public-read',  // 이미지가 public URL로 접근 가능하게 설정
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + '-' + file.originalname); // 이미지 파일 이름 지정
    }
  })
});

const router = express.Router();

// @route   Post api/seniorfaqs/upload
// @desc    Upload an image for a Senior FAQ
// @access  Private
router.post("/upload", upload.single('image'), async (req: Request, res: Response) => {
  const connection: PoolConnection = await Pool.getConnection();
  console.log(req.file);
  try {
    const file = req.file as Express.MulterS3.File;
    const imageUrl = file.location;

    const response: UploadSeniorFAQImageResponse = {
      statusCode: 201,
      message: "Image uploaded successfully",
      data: {
        image_url: imageUrl
      }
    };

    res.status(201).json(response);
  } catch (err: any) {
    const response = {
      statusCode: 500,
      message: err.message,
    };
    console.log(response);
    res.status(500).json(response);
  } finally {
    connection.release();
  }
});

export default router;
