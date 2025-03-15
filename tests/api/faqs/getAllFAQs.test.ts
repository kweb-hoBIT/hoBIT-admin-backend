import app from '../../../src/app';
import { checkApiResponse } from '../../utils/testHelper';
import { Pool } from '../../../config/connectDB';
import { GetAllFAQResponse } from '../../../src/types/faq';

// Mock the database connection
jest.mock('../../../config/connectDB', () => ({
  Pool: {
    getConnection: jest.fn(),
  },
}));

describe('FAQ API', () => {
  let connection: any;

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    jest.restoreAllMocks(); // 모든 Mock 초기화
  });
  
  
  beforeEach(() => {
    // 공통적인 DB 연결 Mock 설정
    connection = {
      execute: jest.fn(),
      release: jest.fn(),
    };
    (Pool.getConnection as jest.Mock).mockResolvedValue(connection);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should get all FAQs successfully', async () => {
    const mockFAQs = [
      {
        id: 1,
        maincategory_ko: '메인 카테고리',
        maincategory_en: 'Main Category',
        subcategory_ko: '서브 카테고리',
        subcategory_en: 'Sub Category',
        question_ko: '질문',
        question_en: 'Question',
        answer_ko: JSON.stringify([{ answer: '답변', url: '', email: '', phone: '' }]),
        answer_en: JSON.stringify([{ answer: 'Answer', url: '', email: '', phone: '' }]),
        manager: 'Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    connection.execute.mockResolvedValueOnce([mockFAQs, []]);

    const response = await checkApiResponse(app, '/api/faqs', 'get', 200) as GetAllFAQResponse;

    expect(response).toEqual({
      statusCode: 200,
      message: 'FAQs retrieved successfully',
      data: {
        faqs: [
          {
            faq_id: 1,
            maincategory_ko: '메인 카테고리',
            maincategory_en: 'Main Category',
            subcategory_ko: '서브 카테고리',
            subcategory_en: 'Sub Category',
            question_ko: '질문',
            question_en: 'Question',
            answer_ko: [{ answer: '답변', url: '', email: '', phone: '' }],
            answer_en: [{ answer: 'Answer', url: '', email: '', phone: '' }],
            manager: 'Admin',
            created_at: expect.any(String),
            updated_at: expect.any(String),
          },
        ],
      },
    });

    // release()가 호출되었는지 확인 (연결을 반환하는 것이 올바르게 이루어지는지 검증)
    expect(connection.release).toHaveBeenCalled();
  });

  it('should handle database errors', async () => {
    const errorMessage = 'Database error';

    connection.execute.mockRejectedValueOnce(new Error(errorMessage));

    const response = await checkApiResponse(app, '/api/faqs', 'get', 500);

    expect(response).toEqual({
      statusCode: 500,
      message: errorMessage,
    });

    expect(connection.release).toHaveBeenCalled();
  });
});
