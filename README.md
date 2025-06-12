# QA 교육용 Todo 백엔드 API 서버

Flutter QA 교육용 Todo 앱을 위한 백엔드 API 서버입니다.

## 🚀 빠른 시작

### 사전 요구사항
- Docker 및 Docker Compose 설치

### 서버 실행

```bash
# 1. 디렉토리로 이동
cd qa_todo_backend

# 2. Docker Compose로 실행
docker-compose up -d

# 3. 서버 상태 확인
curl http://localhost:3000
```

### 수동 실행 (Node.js 환경)

```bash
# 1. 의존성 설치
npm install

# 2. 서버 시작
npm start

# 또는 개발 모드
npm run dev
```

## 📡 API 엔드포인트

### 기본 정보
- **베이스 URL**: `http://localhost:3000`
- **인증 방식**: JWT Bearer Token

### 인증 API

#### 회원가입
```http
POST /register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**응답:**
```json
{
  "success": true,
  "message": "회원가입이 완료되었습니다",
  "userId": 1
}
```

#### 로그인
```http
POST /login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**응답:**
```json
{
  "success": true,
  "message": "로그인 성공",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

### Todo API (인증 필요)

모든 Todo API는 Authorization 헤더에 Bearer Token이 필요합니다:
```http
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Todo 목록 조회
```http
GET /todos
```

**응답:**
```json
{
  "success": true,
  "todos": [
    {
      "id": 1,
      "title": "할일 제목",
      "isCompleted": false,
      "createdAt": "2023-12-01T10:00:00.000Z",
      "updatedAt": "2023-12-01T10:00:00.000Z"
    }
  ]
}
```

#### Todo 생성
```http
POST /todos
Content-Type: application/json

{
  "title": "새로운 할일"
}
```

#### Todo 수정
```http
PUT /todos/:id
Content-Type: application/json

{
  "title": "수정된 할일",
  "isCompleted": true
}
```

#### Todo 삭제
```http
DELETE /todos/:id
```

## 🐛 QA 교육용 의도적 버그

이 서버에는 QA 교육을 위한 의도적인 버그들이 포함되어 있습니다:

### 1. 회원가입 중복 체크 버그
- **문제**: 이메일 중복 체크가 70% 확률로만 동작
- **테스트**: 같은 이메일로 여러 번 회원가입 시도

### 2. Todo 권한 혼동 버그
- **문제**: 10% 확률로 다른 사용자의 Todo가 섞여서 조회됨
- **테스트**: 여러 계정으로 로그인하여 Todo 목록 여러 번 조회

### 3. 삭제 권한 체크 누락
- **문제**: 20% 확률로 다른 사용자의 Todo도 삭제 가능
- **테스트**: 다른 사용자의 Todo ID로 삭제 시도

### 4. 긴 제목 처리 미흡
- **문제**: 100글자 이상 제목도 그대로 저장됨
- **테스트**: 매우 긴 제목으로 Todo 생성

### 5. 동시성 문제 (Race Condition)
- **문제**: Todo 수정 시 의도적 지연으로 데이터 손실 가능
- **테스트**: 동시에 같은 Todo를 빠르게 수정

## 🧪 테스트 가이드

### Postman/Insomnia 사용
1. 먼저 `/register`로 계정 생성
2. `/login`으로 토큰 획득
3. 토큰을 Authorization 헤더에 설정
4. 각 Todo API 테스트

### cURL 예시
```bash
# 회원가입
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# 로그인
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Todo 조회 (토큰 필요)
curl -X GET http://localhost:3000/todos \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🗄️ 데이터베이스

- **엔진**: SQLite
- **파일 위치**: `./qa_todo.db`
- **테이블**: `users`, `todos`

## 🐳 Docker 관리

```bash
# 서버 시작
docker-compose up -d

# 서버 중지
docker-compose down

# 로그 확인
docker-compose logs -f

# 데이터베이스 초기화 (주의: 모든 데이터 삭제)
docker-compose down -v
```

## 🔧 환경 설정

| 환경변수 | 기본값 | 설명 |
|---------|--------|------|
| PORT | 3000 | 서버 포트 |
| NODE_ENV | production | 환경 모드 |
| JWT_SECRET | qa_todo_secret_key | JWT 비밀키 |

## ⚠️ 주의사항

이 서버는 **교육용**으로만 사용해야 합니다:
- 실제 프로덕션 환경에서 사용 금지
- 의도적인 보안 취약점 포함
- 실제 사용자 데이터 저장 금지 