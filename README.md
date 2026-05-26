# Premium SMP 인스타그램 콘텐츠 자동 제작 AI 에이전트 시스템

본 프로젝트는 두피문신(SMP) 전문 브랜드를 위한 **프리미엄 인스타그램 피드 콘텐츠 기획 및 제작 자동화 시스템**입니다. 
한국의 30~50대 여성(정수리 가르마 탈모 고민 고객층)을 핵심 타겟으로 삼아 극사실적이고 내추럴한 감성의 이미지 생성 프롬프트, 인스타 감성의 차분하고 전문적인 캡션, 그리고 타겟팅된 해시태그 세트를 자동으로 기획합니다.

이 시스템은 여러 AI 역할(총괄 기획 AI, 콘텐츠 작성 AI, 두피 분석 Vision AI)이 유기적으로 협업하는 **반자동 콘텐츠 제작 워크플로우**를 제공하며, 최종 승인 및 캡션 미세 조정은 사용자가 직접 텔레그램이나 웹 대시보드에서 제어한 뒤 인스타그램에 수동으로 최종 업로드합니다.

---

## 🛠️ 기술 스택
- **Frontend / Backend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Database / State**: Supabase (PostgreSQL), Row Level Security (RLS)
- **AI Agent**: OpenAI API (GPT-4o / GPT-4o-mini / GPT-4o Vision)
- **Messaging**: Telegram Bot API
- **Deployment & Scheduling**: Vercel & Vercel Cron (매일 오전 9:00 KST 실행)

---

## 🚀 시작하기

### 1. 로컬 개발 환경 설치
프로젝트의 종속성 패키지를 설치합니다:
```bash
npm install
```

### 2. 환경 변수 세팅
루트 디렉토리에 생성된 `.env.local` 파일을 열고 다음과 같이 설정하십시오:
```env
# 1. Supabase API 정보 (Supabase Dashboard -> Settings -> API에서 확인)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key # 백엔드 Webhook/Cron용 우회 키

# 2. OpenAI API 키 (GPT-4o 및 Vision 지원 필수)
OPENAI_API_KEY=sk-proj-your-openai-api-key

# 3. 텔레그램 봇 정보
TELEGRAM_BOT_TOKEN=1234567890:your-bot-token
TELEGRAM_CHAT_ID=your-personal-chat-id

# 4. Vercel 크론 보안 토큰
CRON_SECRET=super_secret_cron_token_123!
```

---

## 💾 3. Supabase 데이터베이스 설정 (테이블 생성)
Supabase 프로젝트 생성 후 **SQL Editor**로 이동하여 프로젝트 루트에 생성되어 있는 `supabase_schema.sql` 파일의 SQL 스크립트를 전체 복사하여 실행하십시오. 
이 스크립트는 다음 세 개의 핵심 테이블을 생성합니다:
1. `content_logs`: AI 기획 피드 정보 (프롬프트 리스트, 캡션, 태그, 승인상태 등)
2. `uploaded_images`: 각 피드 슬라이드별 이미지 URL 보관
3. `user_sessions`: 텔레그램의 대화 상태값(캡션 수정 대기 등)을 추적하기 위한 세션 테이블

---

## 🤖 4. 텔레그램 봇 연결 및 Webhook 등록

### 4-1. 봇 생성 및 Token 획득
1. 텔레그램 앱에서 `@BotFather`를 검색합니다.
2. `/newbot` 명령어를 입력하고 봇의 이름과 사용자명(username, `_bot`으로 끝나야 함)을 순서대로 지정합니다.
3. 생성 완료 시 발급받은 `HTTP API TOKEN`을 복사하여 `.env.local`의 `TELEGRAM_BOT_TOKEN`에 넣습니다.

### 4-2. 개인 Chat ID 획득
1. 텔레그램에서 생성한 봇 또는 `@userinfobot`을 검색하고 대화를 시작합니다.
2. 봇에게 아무 메시지나 보낸 뒤 해당 봇이 반환해 주는 고유 숫자 ID(예: `987654321`)를 복사해 `.env.local`의 `TELEGRAM_CHAT_ID`에 입력합니다.

### 4-3. Webhook 활성화 (반드시 필요)
사용자가 텔레그램에서 버튼을 누르거나 사진을 올렸을 때 Next.js 서버로 신호가 전달되기 위해 Webhook을 등록해야 합니다.
서비스를 Vercel 등에 배포한 후, 브라우저 주소창에 아래 URL을 입력하여 호출하거나 terminal에서 curl 명령을 실행하세요:

```bash
# 브라우저 주소창에 아래를 붙여넣으십시오 (배포된 URL이 https://smp-auto.vercel.app 일 경우)
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://smp-auto.vercel.app/api/telegram/webhook
```
성공 시 `{"ok":true,"result":true,"description":"Webhook was set"}` 메시지가 반환됩니다.

---

## 💻 5. 로컬 개발 서버 실행 및 테스트
로컬에서 프로젝트를 구동합니다:
```bash
npm run dev
```
브라우저에서 `http://localhost:3000`을 열어 고급스러운 **Dark Glassmorphic Web Dashboard**를 확인할 수 있습니다.

### 대시보드 기능
- **AI가 알아서 피드 만들기**: 클릭 즉시 최신 콘텐츠 이력을 기준으로 3개 주제 추천 -> 1순위 자동 선택 -> 5장 인스타 캐러셀 이미지 프롬프트 기획 -> 캡션/해시태그 생성 -> Supabase DB 저장 -> 내 텔레그램으로 즉시 알림 발송.
- **두피/시술 사진 첨부해서 기획하기**: 시술 사례 사진을 드래그 앤 드롭하면 OpenAI Vision API가 두피 탈모 형태 및 성별을 정밀 분석해 맞춤 포트폴리오를 짜 줍니다.
- **Instagram Mockup 슬라이더**: 5장의 연출 컷을 인스타 피드처럼 스와이프하며, 마우스를 올리면 생성 모델용 상세 영문 프롬프트를 확인하고 즉시 복사할 수 있습니다.
- **원클릭 클립보드 복사**: 캡션 및 해시태그 우측 복사 버튼으로 손쉽게 클립보드에 담아 수동 업로드에 활용합니다.
- **실시간 수정/승인**: 대시보드 혹은 텔레그램 내에서 '캡션 수정', '해시태그 수정' 버튼을 눌러 피드 문구를 실시간 정밀 편집하고, '최종 승인'을 처리해 승인 로그로 이관할 수 있습니다.

---

## ⏰ 6. 매일 오전 9시 Vercel Cron 자동 실행
프로젝트 루트의 `vercel.json` 설정에 따라 Vercel 배포 시 자동으로 매일 오전 9:00 KST(UTC 0:00)에 아래 경로를 호출합니다:
- **호출 주소**: `GET /api/telegram/cron`
- **동작**: 매일 아침 내 텔레그램으로 `"📅 좋은 아침입니다! 오늘 SMP 콘텐츠 작업을 진행할까요?"` 알림 메시지와 선택 버튼을 발송하여 아침 루틴에 맞춰 클릭 한 번으로 양질의 콘텐츠를 생성하도록 대기시킵니다.

---

## 🎨 7. 이미지 생성 API 실시간 연결 커스텀 (추후 확장)
현재는 `src/services/imageGenerator.ts` 파일에 프리미엄 헤어살롱/두피 감성의 고해상도 Unsplash 큐레이션 이미지가 Mockup 형태로 연동되어 있습니다. 
추후 DALL-E 3 또는 Flux, SDXL API를 실시간 연동해 이미지를 실제 생성하고 싶으시다면:
1. `.env` 파일에 `ENABLE_LIVE_IMAGE_GEN=true` 추가
2. `IMAGE_GEN_PROVIDER=dalle3` (또는 `flux` / `sdxl`) 설정
3. `imageGenerator.ts` 파일에서 주석 처리된 각 API 연동 코드를 활성화하여 즉시 이미지를 백그라운드에서 진짜로 구동해 Supabase Storage에 저장 및 연결되도록 손쉽게 업그레이드할 수 있습니다.
