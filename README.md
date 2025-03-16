# hoBIT-admin-backend

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
![호빗 db image](https://github.com/user-attachments/assets/c12fb79f-34d3-493f-bafd-589d0f1d6975)

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
