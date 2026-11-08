import mysql from 'mysql2/promise';
import env from './env';
import { initialAudience } from '../src/utils/faqAudience';

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
      audience VARCHAR(20) NOT NULL DEFAULT 'undergraduate',
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

// 엑셀 올리기·되돌리기 전에 faqs·senior_faqs 표 전체를 저장해 두는 곳 (최근 20개만 남김)
//   data: { "faqs": SELECT * FROM faqs, "senior_faqs": SELECT * FROM senior_faqs } JSON
const createFaqBackupsTable = async () => {
  const connection = await createConnection();
  await connection.query(`
    CREATE TABLE IF NOT EXISTS faq_backups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      user_id INT NULL,
      note VARCHAR(300) NOT NULL DEFAULT '',
      row_count INT NOT NULL,
      senior_row_count INT NOT NULL DEFAULT 0,
      data LONGTEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
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
      search_sources JSON NULL,
      updated_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    );
  `;
  await connection.query(query);
  await connection.end();
};

// 이미 만들어진 표에 나중에 추가한 칸 — 없으면 추가하고, 처음 추가할 때만 onAdded 실행
type AddedColumn = {
  table: string;
  column: string;
  definition: string;
  onAdded?: (connection: mysql.Connection) => Promise<void>;
};

// FAQ 대상 처음 값 — 칸을 새로 만들 때 한 번만 (대학원 → 대학원, 행정실·ETC 공통 업무 → 공통, 나머지 학부)
const setInitialFaqAudience = async (connection: mysql.Connection) => {
  const [rows]: any = await connection.query(`SELECT id, maincategory_ko, subcategory_ko FROM faqs`);
  for (const row of rows) {
    const audience = initialAudience(row);
    if (audience !== 'undergraduate') {
      await connection.query(`UPDATE faqs SET audience = ?, updated_at = updated_at WHERE id = ?`, [audience, row.id]);
    }
  }
};

const ADDED_COLUMNS: AddedColumn[] = [
  // 키워드 규칙의 '먼저 찾아볼 곳'
  { table: 'keyword_rules', column: 'search_sources', definition: 'JSON NULL' },
  // FAQ 대상: undergraduate(학부) / graduate(대학원) / all(공통)
  { table: 'faqs', column: 'audience', definition: "VARCHAR(20) NOT NULL DEFAULT 'undergraduate' AFTER manager", onAdded: setInitialFaqAudience },
];

const addColumns = async () => {
  const connection = await createConnection();
  try {
    for (const c of ADDED_COLUMNS) {
      const [rows]: any = await connection.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [c.table, c.column]
      );
      if (rows.length) continue;
      await connection.query(`ALTER TABLE \`${c.table}\` ADD COLUMN \`${c.column}\` ${c.definition}`);
      if (c.onAdded) await c.onAdded(connection);
    }
  } finally {
    await connection.end();
  }
};

// 공지로 바뀐 내용 — 새 공지가 행정실 FAQ·홈페이지 안내의 내용을 바꾸는 경우 (호빗 RAG 수집 때 검사해 추가)
//   hoBIT-rag/scripts/check_notice_changes.py가 넣고, 관리자가 대시보드에서 확인·FAQ 수정 후 '확인함'/'무시'
//   챗봇은 이 표와 상관없이 답변 때 바꾼 공지를 함께 보고 공지를 따름 — 이 표는 FAQ를 사람이 고치도록 알리는 용도
const createNoticeChangesTable = async () => {
  const connection = await createConnection();
  await connection.query(`
    CREATE TABLE IF NOT EXISTS notice_changes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      notice_doc_key VARCHAR(255) NOT NULL,
      notice_title VARCHAR(300) NOT NULL,
      notice_link VARCHAR(500) NULL,
      notice_date DATE NULL,
      target_doc_key VARCHAR(255) NOT NULL,
      target_kind VARCHAR(16) NOT NULL,
      target_title VARCHAR(300) NOT NULL,
      faq_id INT NULL,
      what VARCHAR(200) NOT NULL,
      before_value VARCHAR(300) NULL,
      after_value VARCHAR(300) NOT NULL,
      applies_to VARCHAR(200) NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'new',
      handled_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_change (notice_doc_key(150), target_doc_key(150), what(80)),
      KEY idx_status (status)
    )
  `);
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

// 대학원 학과 (홈페이지 대학원 메뉴) — 이 칸을 처음 쓰게 될 때 한 번만 채움
const GRAD_DEPARTMENT_DEFAULTS: [string, string, string[]][] = [
  ["컴퓨터학과", "Computer Science", []],
  ["인공지능학과", "Artificial Intelligence", []],
  ["뇌공학과", "Brain and Cognitive Engineering", []],
  ["영상정보처리협동과정", "Visual Information Processing", ["영상정보처리"]],
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
  const [grad]: any = await connection.query(`SELECT COUNT(*) AS n FROM profile_options WHERE field = 'grad_department'`);
  if (Number(grad[0].n) === 0) {
    await connection.query(
      `INSERT INTO profile_options (field, value, label_en, aliases, first_cohort, sort_order) VALUES ?`,
      [GRAD_DEPARTMENT_DEFAULTS.map(([value, labelEn, aliases], i) =>
        ["grad_department", value, labelEn, JSON.stringify(aliases), null, i])]
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
  await createNoticeChangesTable();
  await createFaqBackupsTable();
  await addColumns();
};

// 데이터베이스 및 테이블 생성
const initializeDatabase = async () => {
  await createDB();
  await createTables();
};

export { initializeDatabase };