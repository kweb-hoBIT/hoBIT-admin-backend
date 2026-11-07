import mysql from 'mysql2/promise';
import env from './env';

const dbHost = env.DB_HOST;
const dbUser = env.DB_USER;
const dbPassword = env.DB_PASSWORD;
const dbName = env.DB_NAME;
const timezone = env.TIMEZONE;

// 데이터베이스 연결
const createConnection = async (database: string = dbName) => {
  return await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: database,
    timezone: timezone
  });
};

// 데이터베이스 생성 함수
const createDB = async () => {
  const connection = await mysql.createConnection({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.end();
};

// 테이블 생성 쿼리
const createUserTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(45) NOT NULL,
      password VARCHAR(100) NOT NULL,
      username VARCHAR(45) NOT NULL,
      phone_num VARCHAR(45) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;
  await connection.query(query);
  await connection.end();
};

const createFAQTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS faqs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      maincategory_ko VARCHAR(300) NOT NULL,
      maincategory_en VARCHAR(300) NOT NULL,
      subcategory_ko VARCHAR(300) NOT NULL,
      subcategory_en VARCHAR(300) NOT NULL,
      question_ko VARCHAR(300) NOT NULL,
      question_en VARCHAR(300) NOT NULL,
      answer_ko TEXT NOT NULL,
      answer_en TEXT NOT NULL,
      manager VARCHAR(45) NOT NULL,
      category_order INT NOT NULL,
      subcategory_order INT DEFAULT 1,
      created_by INT,
      updated_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
  `;
  await connection.query(query);
  await connection.end();
};

const createSeniorFAQTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS senior_faqs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      maincategory_ko VARCHAR(300) NOT NULL,
      maincategory_en VARCHAR(300) NOT NULL,
      subcategory_ko VARCHAR(300) NOT NULL,
      subcategory_en VARCHAR(300) NOT NULL,
      detailcategory_ko VARCHAR(300) NOT NULL,
      detailcategory_en VARCHAR(300) NOT NULL,
      answer_ko TEXT NOT NULL,
      answer_en TEXT NOT NULL,
      manager VARCHAR(45) NOT NULL,
      category_order INT NOT NULL,
      subcategory_order INT DEFAULT 1,
      detailcategory_order INT DEFAULT 1,
      created_by INT,
      updated_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
  `;
  await connection.query(query);
  await connection.end();
};

const createQuestionLogTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS question_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faq_id INT,
      user_question VARCHAR(300) NOT NULL,
      language VARCHAR(45) NOT NULL,
      feedback_score INT,
      feedback VARCHAR(300),
      ismatched INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faq_id) REFERENCES faqs(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
  `;
  await connection.query(query);
  await connection.end();
};

const createFaqLogTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS faq_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faq_id INT,
      username VARCHAR(45) NOT NULL,
      prev_faq TEXT NOT NULL,
      new_faq TEXT NOT NULL,
      action_type VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faq_id) REFERENCES faqs(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
  `;
  await connection.query(query);
  await connection.end();
};

const createSeniorFaqLogTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS senior_faq_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      senior_faq_id INT,
      username VARCHAR(45) NOT NULL,
      prev_senior_faq TEXT NOT NULL,
      new_senior_faq TEXT NOT NULL,
      action_type VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (senior_faq_id) REFERENCES senior_faqs(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
  `;
  await connection.query(query);
  await connection.end();
};

const createRelatedFaqTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS related_faqs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faq_id INT,
      related_faqs JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (faq_id) REFERENCES faqs(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    );
  `;
  await connection.query(query);
  await connection.end();
};

const createUserFeedbacksTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS user_feedbacks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faq_id INT NULL,
      feedback_reason VARCHAR(255) NULL,
      feedback_detail TEXT NOT NULL,
      language VARCHAR(45) NOT NULL,
      resolved INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (faq_id) REFERENCES faqs(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
  `;
  await connection.query(query);
  await connection.end();
};


// 테이블 생성 실행
// 키워드 규칙 — 입력창 추천(자동완성)·질문 검색에 쓰는 대표 키워드, 연관 단어, 맨 위에 고정할 FAQ
//   예) keyword: 입시 / synonyms: ["수시","정시","이공계","계열"] / pinned_faq_ids: [123]
//   호빗 서버(hoBIT-backend)가 읽어 감 (src/apis/keywordRules.ts)
const createKeywordRulesTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS keyword_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      keyword VARCHAR(100) NOT NULL UNIQUE,
      synonyms JSON NOT NULL,
      pinned_faq_ids JSON NOT NULL,
      updated_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
  `;
  await connection.query(query);
  await connection.end();
};

// 학생 프로필 선택지 — 학과·전공 유형·학적 상태 (관리 > 프로필 항목)
//   호빗 RAG가 1분마다 읽어 화면 선택지, 질문 속 학과 인식, 문서 대상 태그, 검색 필터에 씀 (hoBIT-rag/src/profile_options.py)
//   aliases: 다른 이름·예전 이름 (학과 이름을 바꾸면 예전 이름이 자동으로 들어감)
//   first_cohort: 학과 첫 입학 연도 (그 전 학번과의 조합은 없는 조합으로 안내) / active=0: 학생 선택지에서 숨김
const PROFILE_OPTION_DEFAULTS: [string, string, string, string[], number | null][] = [
  ["department", "컴퓨터학과", "Computer Science", ["컴퓨터공학과", "컴학과", "컴과"], null],
  ["department", "데이터과학과", "Data Science", ["데과"], 2022],
  ["department", "인공지능학과", "Artificial Intelligence", ["인공지능과", "AI학과"], 2025],
  ["major_type", "심화전공", "Intensive Major", [], null],
  ["major_type", "이중전공", "Double Major", [], null],
  ["major_type", "복수전공", "Multiple Major", [], null],
  ["major_type", "부전공", "Minor", [], null],
  ["student_status", "재학", "Enrolled", [], null],
  ["student_status", "편입", "Transfer", [], null],
  ["student_status", "휴학", "Leave of Absence", [], null],
  ["student_status", "수료", "Completed", [], null],
];

const createProfileOptionsTable = async () => {
  const connection = await createConnection();
  await connection.query(`
    CREATE TABLE IF NOT EXISTS profile_options (
      id INT AUTO_INCREMENT PRIMARY KEY,
      field VARCHAR(32) NOT NULL,
      value VARCHAR(100) NOT NULL,
      label_en VARCHAR(100) NOT NULL,
      aliases JSON NOT NULL,
      first_cohort INT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      active TINYINT NOT NULL DEFAULT 1,
      updated_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_profile_option (field, value),
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  // 처음 만들 때만 지금까지 코드에 있던 값으로 채움
  const [rows]: any = await connection.query(`SELECT COUNT(*) AS n FROM profile_options`);
  if (Number(rows[0].n) === 0) {
    await connection.query(
      `INSERT INTO profile_options (field, value, label_en, aliases, first_cohort, sort_order) VALUES ?`,
      [PROFILE_OPTION_DEFAULTS.map(([field, value, labelEn, aliases, first], i) =>
        [field, value, labelEn, JSON.stringify(aliases), first, i])]
    );
  }
  await connection.end();
};

const createTables = async () => {
  await createUserTable();
  await createFAQTable();
  await createSeniorFAQTable();
  await createQuestionLogTable();
  await createFaqLogTable();
  await createSeniorFaqLogTable();
  await createRelatedFaqTable();
  await createUserFeedbacksTable();
  await createKeywordRulesTable();
  await createProfileOptionsTable();
};

// 데이터베이스 및 테이블 생성
const initializeDatabase = async () => {
  await createDB();
  await createTables();
};

export { initializeDatabase };