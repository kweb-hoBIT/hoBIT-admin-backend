# hoBIT-admin-backend

## System Requirements

- MySQL DB

## Installation

Clone the repository:

```bash
git clone https://github.com/kweb-hoBIT/hoBIT-admin-backend.git
```

Install dependencies:

```bash
npm install
npm run tsc
```

Copy the `.env.example` file and rename it to `.env`, then update its contents with your configuration:

```bash
cp .env.example .env
```

Edit the `.env` file to include the correct settings for your environment (e.g., database credentials).

Start Application:

```bash
npm start
```

## 배포

- `ec2` 인스턴스 생성하여 운영
- `docker` 컨테이너로 `mysql` 데이터베이스 운영(예정)
- `pm2` 사용하여 `express.js` 서버를 백그라운드 프로세스로 관리
- `Caddy` 사용하여 `https` 로 배포

# 가이드라인

## 브랜치 전략

### 작업 순서

- 평소
  1. `develop`에서 `feature/~` 브랜치 생성 후 작업
  2. 로컬 테스트 후 이상 없을 시 `develop`으로 PR
  3. 상호 코드 리뷰
  4. `Approve`시 `develop`에 merge
  5. 어느 정도 커밋이 쌓이면 `develop`에서 `release/<version>` 브랜치 생성
  6. QA 진행, 수정사항 발생 시 해당 release 브랜치에서 작업 후 commit
  7. 모든 테스트 완료 후 `main`으로 merge 및 배포
- 긴급 수정(hotfix)
  1. 관리자에게 연락
  2. `main`에서 `hotfix`브랜치 생성 후 작업
  3. 로컬 테스트 후 `main` 으로 PR
  4. 관리자 확인 후 `merge`

### Git 사용하기

- Branch Usage
  - Repository name should be like following format
    - `feature/<issue_number>`
    - `feature/<feature_name>`
    - `release/<version_number>`
    - `hotfix/<issue_number>`
- Commit Message
  - Commit with the smallest change unit
  - Use category in commit messages
    - `int`: only for initial commit
    - `doc`: changes document or comment
    - `ftr`: add new feature
    - `mod`: modify existing feature
    - `fix`: fix an error or issue
    - `rfc`: refactor code
    - `add`: add new file or directory
    - `rmv`: remove existing file or directory
  - Example
    - `int: initial commit`


## API 명세서

[http://admin.hobit.kr/api-docs](http://admin.hobit.kr/api-docs)

## ENV 변수

`hobit` 에 사용되는 환경변수: 


| 변수명                 | 설명 |
|------------------------|--------------------------------|
| `PORT`                | 서버가 실행될 포트 번호 |
| `API_URL`             | API의 기본 URL |
| `CLIENT_URL1`         | 첫 번째 클라이언트 URL (로컬) |
| `CLIENT_URL2`         | 두 번째 클라이언트 URL (로컬) |
| `TIMEZONE`            | 서버의 기본 시간대 |
| `DB_HOST`             | 데이터베이스 호스트 주소 |
| `DB_USER`             | 데이터베이스 사용자명 |
| `DB_PASSWORD`         | 데이터베이스 비밀번호 |
| `JWT_SECRET`          | JWT 토큰 서명 키 |
| `JWT_EXPIRATION`      | JWT 액세스 토큰 만료 시간 |
| `JWT_REFRESH_EXPIRATION` | JWT 리프레시 토큰 만료 시간 |
| `OPENAI_API_KEY`      | OpenAI API 키 |
| `DEEPL_API_KEY`       | DEEPL API 키 |
| `MANAGER_KEY`         | 관리자 전용 키 |


## HoBIT DB 스키마

#### Tables

`hobit` 데이터베이스에 정의되어 있는 테이블들:

##### `users`

| 컬럼         | 타입                                                              | 설명                                       |
| ------------ | ----------------------------------------------------------------- | ------------------------------------------ |
| `id`         | INT, PRIMARY KEY, AUTO_INCREMENT                                  | 사용자의 고유 식별자.                      |
| `email`      | VARCHAR(45), NOT NULL                                             | 사용자의 이메일 주소.                      |
| `password`   | VARCHAR(100), NOT NULL                                            | 사용자의 해시 처리된 비밀번호.             |
| `username`   | VARCHAR(45), NOT NULL                                             | 사용자의 사용자 이름.                      |
| `phone_num`  | VARCHAR(45), NOT NULL                                             | 사용자의 전화 번호.                        |
| `created_at` | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP                              | 사용자가 생성된 타임스탬프.                |
| `updated_at` | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP, ON UPDATE CURRENT_TIMESTAMP | 사용자가 마지막으로 업데이트된 타임스탬프. |

##### `faqs`

| 컬럼              | 타입                                                              | 설명                                                               |
| ----------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `id`              | INT, PRIMARY KEY, AUTO_INCREMENT                                  | FAQ의 고유 식별자.                                                 |
| `maincategory_ko` | VARCHAR(300), NOT NULL                                            | FAQ의 메인 카테고리 (한국어).                                      |
| `maincategory_en` | VARCHAR(300), NOT NULL                                            | FAQ의 메인 카테고리 (영어).                                        |
| `subcategory_ko`  | VARCHAR(300), NOT NULL                                            | FAQ의 서브 카테고리 (한국어).                                      |
| `subcategory_en`  | VARCHAR(300), NOT NULL                                            | FAQ의 서브 카테고리 (영어).                                        |
| `question_ko`     | VARCHAR(300), NOT NULL                                            | FAQ의 질문 (한국어).                                               |
| `question_en`     | VARCHAR(300), NOT NULL                                            | FAQ의 질문 (영어).                                                 |
| `answer_ko`       | TEXT, NOT NULL                                                    | FAQ의 답변 (한국어).                                               |
| `answer_en`       | TEXT, NOT NULL                                                    | FAQ의 답변 (영어).                                                 |
| `manager`         | VARCHAR(45), NOT NULL                                             | FAQ 담당 관리자.                                                   |
| `created_by`      | INT, DEFAULT NULL                                                 | FAQ를 생성한 사용자의 ID. `users` 테이블의 외래 키.                |
| `updated_by`      | INT, DEFAULT NULL                                                 | FAQ를 마지막으로 업데이트한 사용자의 ID. `users` 테이블의 외래 키. |
| `created_at`      | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP                              | FAQ가 생성된 타임스탬프.                                           |
| `updated_at`      | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP, ON UPDATE CURRENT_TIMESTAMP | FAQ가 마지막으로 업데이트된 타임스탬프.                            |

##### `senior_faqs`

| 컬럼                | 타입                                                              | 설명                                                                      |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `id`                | INT, PRIMARY KEY, AUTO_INCREMENT                                  | 시니어 FAQ의 고유 식별자.                                                 |
| `maincategory_ko`   | VARCHAR(300), NOT NULL                                            | 시니어 FAQ의 메인 카테고리 (한국어).                                      |
| `maincategory_en`   | VARCHAR(300), NOT NULL                                            | 시니어 FAQ의 메인 카테고리 (영어).                                        |
| `subcategory_ko`    | VARCHAR(300), NOT NULL                                            | 시니어 FAQ의 서브 카테고리 (한국어).                                      |
| `subcategory_en`    | VARCHAR(300), NOT NULL                                            | 시니어 FAQ의 서브 카테고리 (영어).                                        |
| `detailcategory_ko` | VARCHAR(300), NOT NULL                                            | 시니어 FAQ의 상세 카테고리 (한국어).                                      |
| `detailcategory_en` | VARCHAR(300), NOT NULL                                            | 시니어 FAQ의 상세 카테고리 (영어).                                        |
| `answer_ko`         | TEXT, NOT NULL                                                    | 시니어 FAQ의 답변 (한국어).                                               |
| `answer_en`         | TEXT, NOT NULL                                                    | 시니어 FAQ의 답변 (영어).                                                 |
| `manager`           | VARCHAR(45), NOT NULL                                             | 시니어 FAQ 담당 관리자.                                                   |
| `created_by`        | INT, DEFAULT NULL                                                 | 시니어 FAQ를 생성한 사용자의 ID. `users` 테이블의 외래 키.                |
| `updated_by`        | INT, DEFAULT NULL                                                 | 시니어 FAQ를 마지막으로 업데이트한 사용자의 ID. `users` 테이블의 외래 키. |
| `created_at`        | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP                              | 시니어 FAQ가 생성된 타임스탬프.                                           |
| `updated_at`        | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP, ON UPDATE CURRENT_TIMESTAMP | 시니어 FAQ가 마지막으로 업데이트된 타임스탬프.                            |

##### `question_logs`

| 컬럼             | 타입                                 | 설명                                    |
| ---------------- | ------------------------------------ | --------------------------------------- |
| `id`             | INT, PRIMARY KEY, AUTO_INCREMENT     | 질문 로그의 고유 식별자.                |
| `faq_id`         | INT                                  | 관련 FAQ의 ID. `faqs` 테이블의 외래 키. |
| `user_question`  | VARCHAR(300), NOT NULL               | 사용자의 질문.                          |
| `language`       | VARCHAR(45), NOT NULL                | 질문의 언어.                            |
| `feedback_score` | INT                                  | 질문에 대한 피드백 점수.                |
| `feedback`       | VARCHAR(300)                         | 질문에 대한 피드백.                     |
| `created_at`     | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP | 질문 로그가 생성된 타임스탬프.          |

##### `faq_logs`

| 컬럼          | 타입                                 | 설명                                    |
| ------------- | ------------------------------------ | --------------------------------------- |
| `id`          | INT, PRIMARY KEY, AUTO_INCREMENT     | FAQ 로그의 고유 식별자.                 |
| `faq_id`      | INT                                  | 관련 FAQ의 ID. `faqs` 테이블의 외래 키. |
| `username`    | VARCHAR(45), NOT NULL                | 변경을 수행한 사용자의 사용자 이름.     |
| `prev_faq`    | TEXT, NOT NULL                       | FAQ의 이전 상태.                        |
| `new_faq`     | TEXT, NOT NULL                       | FAQ의 새로운 상태.                      |
| `action_type` | VARCHAR(255), NOT NULL               | FAQ에 수행된 액션 유형.                 |
| `created_at`  | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP | 로그가 생성된 타임스탬프.               |

##### `senior_faq_logs`

| 컬럼              | 타입                                 | 설명                                                  |
| ----------------- | ------------------------------------ | ----------------------------------------------------- |
| `id`              | INT, PRIMARY KEY, AUTO_INCREMENT     | 시니어 FAQ 로그의 고유 식별자.                        |
| `senior_faq_id`   | INT                                  | 관련 시니어 FAQ의 ID. `senior_faqs` 테이블의 외래 키. |
| `username`        | VARCHAR(45), NOT NULL                | 변경을 수행한 사용자의 사용자 이름.                   |
| `prev_senior_faq` | TEXT, NOT NULL                       | 시니어 FAQ의 이전 상태.                               |
| `new_senior_faq`  | TEXT, NOT NULL                       | 시니어 FAQ의 새로운 상태.                             |
| `action_type`     | VARCHAR(255), NOT NULL               | 시니어 FAQ에 수행된 액션 유형.                        |
| `created_at`      | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP | 로그가 생성된 타임스탬프.                             |

##### `related_faqs`

| 컬럼           | 타입                                                              | 설명                                         |
| -------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| `id`           | INT, PRIMARY KEY, AUTO_INCREMENT                                  | 관련 FAQ의 고유 식별자.                      |
| `faq_id`       | INT                                                               | FAQ의 ID. `faqs` 테이블의 외래 키.           |
| `related_faqs` | JSON                                                              | 관련 FAQ ID의 JSON.                          |
| `created_at`   | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP                              | 관련 FAQ가 생성된 타임스탬프.                |
| `updated_at`   | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP, ON UPDATE CURRENT_TIMESTAMP | 관련 FAQ가 마지막으로 업데이트된 타임스탬프. |

##### `user_feedbacks`

| 컬럼              | 타입                                 | 설명                                    |
| ----------------- | ------------------------------------ | --------------------------------------- |
| `id`              | INT, PRIMARY KEY, AUTO_INCREMENT     | 사용자 피드백의 고유 식별자.            |
| `faq_id`          | INT                                  | 관련 FAQ의 ID. `faqs` 테이블의 외래 키. |
| `feedback_reason` | VARCHAR(255)                         | 피드백 이유.                            |
| `feedback_detail` | TEXT, NOT NULL                       | 사용자의 상세 피드백.                   |
| `language`        | VARCHAR(45), NOT NULL                | 피드백 언어.                            |
| `resolved`        | INT, DEFAULT 0                       | 피드백 해결 여부 (0 또는 1).            |
| `created_at`      | TIMESTAMP, DEFAULT CURRENT_TIMESTAMP | 피드백이 생성된 타임스탬프.             |
