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
