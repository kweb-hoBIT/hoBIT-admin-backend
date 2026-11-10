import mysql from 'mysql2/promise';
import env from './env';
import { initialAudience } from '../src/utils/faqAudience';
import {
  AUTO_FEEDBACK_REASON,
  mergeSamples,
  normalizeQuestion,
  parseAutoFeedbackDetail,
  maskProfanity,
  parseSamples,
  Sample,
} from '../src/utils/faqCandidateRules';

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
//   영어 모드용: keyword_en(영어 대표 키워드) / synonyms_en(영어 단어·약어)
//   예) 컴퓨터학과 ← 컴학, 컴과  /  computer science ← cs, comp sci
//   호빗 서버(hoBIT-backend)가 읽어 감 (src/apis/keywordRules.ts)
const createKeywordRulesTable = async () => {
  const connection = await createConnection();
  const query = `
    CREATE TABLE IF NOT EXISTS keyword_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      keyword VARCHAR(100) NOT NULL UNIQUE,
      keyword_en VARCHAR(100) NULL,
      synonyms JSON NOT NULL,
      synonyms_en JSON NULL,
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
  // 키워드 규칙의 영어 대표 키워드·영어 단어 (비어 있으면 예전처럼 synonyms에 섞인 영어 단어로만 비교)
  { table: 'keyword_rules', column: 'keyword_en', definition: 'VARCHAR(100) NULL AFTER keyword' },
  { table: 'keyword_rules', column: 'synonyms_en', definition: 'JSON NULL AFTER synonyms' },
  // FAQ 대상: undergraduate(학부) / graduate(대학원) / all(공통)
  { table: 'faqs', column: 'audience', definition: "VARCHAR(20) NOT NULL DEFAULT 'undergraduate' AFTER manager", onAdded: setInitialFaqAudience },
  // FAQ 후보 주제 (호빗 RAG가 정함 — 주제 지도 단어 → 가까운 FAQ 분류 → AI). 비어 있으면 다음 밤 작업·'지금 모으기'가 채움
  { table: 'faq_candidates', column: 'topic_id', definition: 'VARCHAR(32) NULL' },
  { table: 'faq_candidates', column: 'topic_name', definition: 'VARCHAR(50) NULL' },
  { table: 'faq_candidates', column: 'subtopic', definition: 'VARCHAR(100) NULL' },
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

// FAQ 후보 — 학생이 물었지만 호빗이 답을 못 찾은 질문을 비슷한 것끼리 모은 것 (밤 12시 src/scripts/faqCandidates.ts)
//   question: 대표 문장(한국어) / ask_count: 물은 횟수 / samples: 학생 원래 문장 최근 8개 [{text, language, at}] (JSON)
//   status: open(열림) | done(FAQ 만듦) | dismissed(제외)
//   similar_faq_*: 이미 비슷한 FAQ가 있으면 — 검색이 놓친 것이라 FAQ 대신 키워드 규칙을 고칠 일
const createFaqCandidatesTable = async () => {
  const connection = await createConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS faq_candidates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        question VARCHAR(300) NOT NULL,
        ask_count INT NOT NULL DEFAULT 1,
        samples TEXT NULL,
        first_asked_at TIMESTAMP NULL,
        last_asked_at TIMESTAMP NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'open',
        similar_faq_id INT NULL,
        similar_faq_question VARCHAR(300) NULL,
        similar_faq_senior TINYINT NOT NULL DEFAULT 0,
        similar_score FLOAT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_status_count (status, ask_count)
      )
    `);
    await moveAutoFeedbacksToCandidates(connection);
  } finally {
    await connection.end();
  }
};

// 예전 밤 작업이 user_feedbacks에 넣은 '질문을 추가해주세요!' 기록 → FAQ 후보로 한 번 옮김
//   처리 안 한 것만 후보로 (같은 글자는 합쳐 물은 횟수를 더함), 옮긴 뒤 자동 기록은 처리한 것까지 모두 지움
//   (처리한 것은 이미 FAQ를 만들었거나 넘긴 것이라 후보로 다시 띄울 필요가 없고, 피드백 목록엔 학생이 남긴 것만 남기려고)
//   지운 뒤에는 자동 기록이 없으므로 다시 켜도 아무것도 안 함 — 한 번만 실행됨
const moveAutoFeedbacksToCandidates = async (connection: mysql.Connection) => {
  const [rows]: any = await connection.query(
    `SELECT id, feedback_detail, resolved, created_at FROM user_feedbacks WHERE feedback_reason = ? ORDER BY created_at`,
    [AUTO_FEEDBACK_REASON]
  );
  if (!rows.length) return;
  const groups = new Map<string, { question: string; samples: Sample[]; first: Date; last: Date }>();
  for (const r of rows) {
    if (Number(r.resolved)) continue;
    const q = parseAutoFeedbackDetail(r.feedback_detail);
    if (!q) continue;
    const key = normalizeQuestion(q);
    const at = new Date(r.created_at);
    const g = groups.get(key);
    const sample = { text: q, language: 'KO', at: at.toISOString() };
    if (g) {
      g.samples.push(sample);
      if (at < g.first) g.first = at;
      if (at > g.last) g.last = at;
    } else groups.set(key, { question: q, samples: [sample], first: at, last: at });
  }
  await connection.beginTransaction();
  try {
    const [cands]: any = await connection.query(`SELECT id, question, samples FROM faq_candidates`);
    const byNorm = new Map<string, any>(cands.map((c: any) => [normalizeQuestion(c.question), c]));
    for (const [key, g] of groups) {
      const c = byNorm.get(key);
      if (c) {
        await connection.query(
          `UPDATE faq_candidates SET ask_count = ask_count + ?, samples = ?,
                  first_asked_at = LEAST(COALESCE(first_asked_at, ?), ?), last_asked_at = GREATEST(COALESCE(last_asked_at, ?), ?)
            WHERE id = ?`,
          [g.samples.length, JSON.stringify(mergeSamples(parseSamples(c.samples), g.samples)), g.first, g.first, g.last, g.last, c.id]
        );
      } else {
        await connection.query(
          `INSERT INTO faq_candidates (question, ask_count, samples, first_asked_at, last_asked_at) VALUES (?, ?, ?, ?, ?)`,
          [g.question.slice(0, 300), g.samples.length, JSON.stringify(mergeSamples([], g.samples)), g.first, g.last]
        );
      }
    }
    await connection.query(`DELETE FROM user_feedbacks WHERE id IN (?)`, [rows.map((r: any) => r.id)]);
    await connection.commit();
    console.log(`[faq_candidates] 예전 자동 피드백 ${rows.length}개 정리 → 후보 ${groups.size}개`);
  } catch (e) {
    await connection.rollback();
    throw e;
  }
};

// FAQ 후보에 들어간 학생 질문 원문 전부 (samples는 최근 8개뿐) — 후보를 지우면 같이 지워짐
//   밤 작업이 넣음. 예전 자동 피드백에서 옮긴 후보는 원문이 samples뿐이라 처음 한 번 samples로 채움
const createFaqCandidateQuestionsTable = async () => {
  const connection = await createConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS faq_candidate_questions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidate_id INT NOT NULL,
        log_id INT NULL,
        text VARCHAR(300) NOT NULL,
        language VARCHAR(45) NOT NULL DEFAULT 'KO',
        asked_at TIMESTAMP NULL,
        KEY idx_candidate (candidate_id, asked_at),
        FOREIGN KEY (candidate_id) REFERENCES faq_candidates(id) ON DELETE CASCADE
      )
    `);
    // 원문이 하나도 없는 후보만 — 한 번 채우면 다시 대상이 아니라 켤 때마다 돌아도 한 번만 들어감
    const [rows]: any = await connection.query(`
      SELECT c.id, c.samples FROM faq_candidates c
       WHERE NOT EXISTS (SELECT 1 FROM faq_candidate_questions q WHERE q.candidate_id = c.id)`);
    const values = rows.flatMap((r: any) =>
      parseSamples(r.samples).map((smp) => [
        r.id, maskProfanity(smp.text).slice(0, 300), smp.language || 'KO', smp.at ? new Date(smp.at) : null,
      ])
    );
    if (values.length) {
      await connection.query(`INSERT INTO faq_candidate_questions (candidate_id, text, language, asked_at) VALUES ?`, [values]);
      console.log(`[faq_candidates] 원문 ${values.length}개를 samples에서 채움`);
    }
  } finally {
    await connection.end();
  }
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
  await createFaqCandidatesTable(); // 아래 addColumns가 이 표에 칸을 더하므로 먼저
  await addColumns();
  await createFaqCandidateQuestionsTable();
};

// 데이터베이스 및 테이블 생성
const initializeDatabase = async () => {
  await createDB();
  await createTables();
};

export { initializeDatabase };