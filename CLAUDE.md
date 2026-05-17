@AGENTS.md

# Apartment Audit System (AAS) — Claude Code 가이드

## 프로젝트 개요
아파트 입주자대표회의 감사 역할자를 위한 디지털 감사 플랫폼.
영수증 자동 검증, 관리비 이상 탐지, 감사 보고서 자동 생성이 핵심 기능.

## 기술 스택
- Framework: Next.js 16 (App Router, TypeScript)
- Database/Auth/Storage: Supabase (PostgreSQL + RLS)
- UI: shadcn/ui + Tailwind CSS + Recharts + TanStack Table
- Form: React Hook Form + Zod
- State: TanStack Query (서버), Zustand (클라이언트)
- AI: Google Gemini API (gemini-2.5-flash, 멀티모달 OCR + 13요소 파싱)
- PDF: @react-pdf/renderer v4 (서버사이드 렌더링)
- Deploy: Vercel

## 핵심 비즈니스 규칙

### 영수증 검증 파이프라인 (P2→P3→P4)
- P2: Gemini 멀티모달로 이미지 직접 분석 → OCR 텍스트 + 13요소 JSON 동시 추출
- P3: 정책 4필터 자동 검사 (쪼개기/시간대/금지업종/한도초과)
- P4: 100건 이상 누적 후 Benford's Law + ACFE 패턴 분석

### Confidence 임계값
- ≥ 0.95: 자동 승인
- 0.85~0.95: 승인 + 알림
- 0.65~0.85: 수동 검수 큐
- < 0.65: 즉시 반려

### HITL 원칙
AI는 제안만 하고, 최종 승인/반려는 반드시 사람(감사)이 한다.

---

## 완성된 기능 목록 (2026-05-16 기준)

### ✅ Phase 1 — 인증 & 기반
- Supabase Auth (이메일/비밀번호, 소셜 예정)
- 회원가입 → 아파트 단지 설정 (`/setup`)
- 비밀번호 찾기 / 재설정
- RLS 기반 다중 단지 데이터 격리

### ✅ Phase 1 — 영수증 검증
- 영수증 이미지 업로드 (드래그앤드롭, `/receipts`)
- Gemini 멀티모달 OCR + 13요소 자동 파싱 (`POST /api/ocr`)
- 정책 4필터 자동 검사 (`POST /api/receipts/validate`)
  - 쪼개기 탐지 / 시간대 제한 / 금지업종 / 한도초과
- confidence 기반 자동 승인/수동검수/즉시반려
- 수동 검수 화면 (`/receipts/review`) — 감사인 승인·반려·수정
- SHA-256 증빙 파일 무결성 검증 + 감사 로그 (`lib/evidence.ts`)

### ✅ Phase 1 — 대시보드
- 영수증 현황 KPI (총 건수, 이상 건수, 총 지출액)
- 월별 지출 추이 차트 (Recharts)
- 알림 벨 (실시간 읽음 처리)

### ✅ Phase 2 — 감사 체크리스트
- 공동주택관리법 기반 체크리스트 자동 생성 (`/audit`)
- 항목별 pass/fail/na 처리, 메모, 증빙파일 첨부
- 체크리스트 상태 관리 (draft → in_progress → completed)

### ✅ Phase 2 — 장기수선충당금 (`/long-term-repair`)
- 연도·월별 계획액/실행액/잔액 등록 및 조회
- 계획 대비 이행률 차트
- 미계획 지출(is_unplanned) 추적
- 소진 예상일 분석 (DepletionStatus)
- 초과 집행 시 audit_findings 자동 등록

### ✅ Phase 2 — 잡수입 관리 (`/misc-income`)
- 유형별(재활용·주차·임대·이자·연체료·기타) 등록 및 조회
- 월별 유형별 바 차트
- 이상 감지: 재활용 수입 급감, 주차 면제율 과다, 계약서 미첨부, 미수납
- 이상 건 audit_findings 자동 등록

### ✅ Phase 2 — 입찰·계약 관리 (`/contracts`)
- 계약 등록 (서비스/공사/물품/입찰/수의계약)
- 계약서 파일 업로드 (Supabase Storage)
- 계약 현황 테이블 (상태 필터·정렬)
- 사업자번호 유효성 검증 (`lib/utils/business-number.ts`)

### ✅ Phase 2 — 재심의 요청 (`/reconsideration`)
- 법적 근거 기반 재심의 요청 작성·발송
- 상태 추적 (SENT → RECEIVED → RESOLVED → ESCALATED)
- 처리 결과 기록

### ✅ UI 리디자인 (2026-05-17)
- 전체 배경: `bg-slate-100` (쿨 블루-그레이, SOYO HANNAM 톤)
- 사이드바: `#8BADD9` 퍼리윙클 블루, 활성 메뉴 `bg-white/20`, role prop으로 auditor 전용 메뉴 분기
- 대시보드 KPI 카드: `rounded-2xl shadow-sm`, 컬러 아이콘 배경, 이상건수 빨간 배지
- 로그인 화면: 원본 이미지 전체 배경 + `backdrop-blur-xl` 중앙 글라스 카드
- Auth 레이아웃 분리: 각 auth 페이지 자체 `min-h-screen` 래퍼 적용 (layout은 passthrough)

### ✅ 사용자 관리 (`/settings/users`)
- auditor 역할만 접근 가능 (비권한자 `/dashboard` 리다이렉트)
- 단지 소속 구성원 목록 테이블 (이메일·이름·역할·가입일·마지막 로그인)
- 역할 인라인 드롭다운 즉시 변경 → `user_metadata.role` 업데이트
  - 역할: `auditor(감사인)` / `accountant(회계담당자)` / `manager(관리소장)` / `external(외부인)`
- 유저 초대: 이메일 + 역할 선택 → `inviteUserByEmail` 발송
- 사이드바 "사용자 관리" 메뉴: auditor 역할만 표시 (layout에서 role prop 전달)

### ✅ Phase 2 — 알림 시스템
- 이상 감지 시 알림 자동 생성 (INFO/WARNING/CRITICAL)
- 헤더 알림 벨 + 읽음 처리 (`GET/PATCH /api/notifications`)

### ✅ Phase 2 — 감사 보고서 PDF (`/reports`)
- 기간(from~to) 선택 → PDF 자동 생성·다운로드
- 공동주택관리법 제26조 형식 준수 (A4, 5페이지)
- 포함 내용:
  - 표지: 아파트명·감사기간·감사인·서명란
  - 제1장: 감사 결과 요약 (KPI 통계표)
  - 제2장: 영수증 이상 건 상세 목록 (flags 포함)
  - 제3장: 감사 지적사항 (audit_findings)
  - 제4장: 재심의 요청 내역 및 처리 결과
  - 제5장: 잡수입 유형별 현황
  - 제6장: 장기수선충당금 이행 현황
- 한글 폰트: NotoSansKR (`public/fonts/` — 로컬 woff 파일)

---

## API 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/auth/callback` | Supabase OAuth 콜백 처리 |
| `POST` | `/api/ocr` | 영수증 이미지 → Gemini OCR + 13요소 파싱 |
| `POST` | `/api/receipts/validate` | 정책 4필터 검사 (P3) |
| `GET` | `/api/notifications` | 로그인 사용자 알림 목록 조회 |
| `PATCH` | `/api/notifications` | 알림 읽음 처리 (단건 또는 전체) |
| `GET` | `/api/reports/generate` | 감사 보고서 PDF 생성 (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) |
| `POST` | `/api/pattern-analysis` | P4 누적 패턴 분석 (Benford's Law + ACFE 6종 탐지 + 외부감사 리스크 가중치 → audit_findings 자동 등록) |
| `GET` | `/api/kapt` | 최신 K-apt 유사단지 비교 데이터 조회 |
| `POST` | `/api/kapt` | K-apt 공공API 호출 → 유사단지 비교 → kapt_comparison upsert + [평균초과] findings 등록 |
| `GET` | `/api/external-audits` | 해당 단지의 연도별 외부감사 목록 조회 (`?year=YYYY` 필터) |
| `POST` | `/api/external-audits` | external_audits 저장 + findings 일괄 INSERT |
| `GET` | `/api/admin/users` | 단지 소속 유저 목록 (auditor 전용, Admin SDK) |
| `PATCH` | `/api/admin/users` | user_metadata.role 업데이트 |
| `POST` | `/api/admin/users` | 유저 초대 (inviteUserByEmail + 역할 설정) |

### Server Actions (`'use server'`)
| 파일 | 주요 함수 |
|------|-----------|
| `lib/actions/auth.ts` | `login`, `logout`, `signup`, `forgotPassword`, `resetPassword` |
| `lib/actions/apartment.ts` | `setupApartment`, `getApartmentInfo` |
| `lib/actions/receipts.ts` | `approveReceipt`, `rejectReceipt` |
| `lib/actions/checklist.ts` | `getOrCreateChecklist`, `toggleChecklistItem`, `updateChecklistItemNote`, `uploadChecklistEvidence` |
| `lib/actions/contracts.ts` | `getContracts`, `createContract`, `deleteContract`, `uploadContractFile` |
| `lib/actions/long-term-repair.ts` | `getLongTermRepairData`, `createRepairEntry`, `deleteRepairEntry`, `uploadRepairFile`, `getDepletionStatus` |
| `lib/actions/misc-income.ts` | `getMiscIncomeData`, `createMiscIncome`, `deleteMiscIncome`, `updatePaymentStatus`, `uploadMiscIncomeFile` |
| `lib/actions/reconsideration.ts` | `getReconsiderations`, `createReconsideration`, `updateResolution`, `uploadReconDocument` |
| `lib/actions/report-data.ts` | `fetchReportData` (PDF용 데이터 취합, Server Action 아님) |
| `lib/actions/kapt.ts` | `getKaptComparison` |
| `lib/actions/external-audits.ts` | `getExternalAudits`, `getExternalAudit`, `createExternalAudit`, `createExternalAuditFindings` |
| `lib/notifications/create.ts` | `createNotificationsForComplex` |
| `lib/actions/kapt.ts` | `getKaptComparison` |

---

## 폴더 구조
```
app/
  (auth)/           → 로그인·회원가입·비밀번호
  (app)/
    dashboard/      → 메인 대시보드
    receipts/       → 영수증 목록
    receipts/review/→ 수동 검수
    audit/          → 감사 체크리스트
    long-term-repair/ → 장기수선충당금
    contracts/      → 입찰·계약 관리
    misc-income/    → 잡수입 관리
    reconsideration/→ 재심의 요청
    external-audits/→ 외부 회계감사 목록
    external-audits/new/ → 외부감사 등록
    external-audits/[id]/findings/ → 지적사항 일괄 입력
    reports/        → 감사 보고서 PDF
    settings/users/ → 사용자 권한 관리 (auditor 전용)
  api/
    ocr/            → Gemini OCR 파이프라인
    receipts/validate/ → 정책 4필터 검사
    notifications/  → 알림 CRUD
    reports/generate/  → PDF 생성 스트림
    admin/users/    → 유저 목록·역할변경·초대 (Admin SDK, auditor 전용)

components/
  ui/               → shadcn (건드리지 말 것)
  receipts/         → UploadDropzone, ReceiptList, ReviewClient
  dashboard/        → SpendingChart
  audit/            → AuditChecklist
  contracts/        → ContractsClient
  long-term-repair/ → RepairClient, RepairCharts
  misc-income/      → MiscIncomeClient, MiscIncomeChart
  reconsideration/  → ReconsiderationClient
  reports/          → AuditReportDocument (PDF), ReportPageClient
  external-audits/  → NewAuditClient, FindingsBatchClient, ExternalAuditsClient
  settings/         → UsersManagementClient
  layout/           → Sidebar (role prop으로 auditor 메뉴 분기), NotificationBell

lib/
  supabase/         → client.ts, server.ts, admin.ts
  actions/          → 모든 Server Actions
  notifications/    → 알림 생성 유틸
  evidence.ts       → SHA-256 무결성 + 감사 로그
  utils.ts          → cn() 등 공통 유틸
  utils/business-number.ts → 사업자번호 검증

public/
  fonts/            → NotoSansKR woff (PDF 한글 렌더링용, git 포함)
  images/           → login-bg.jpg (원본), login-bg-building.jpg (건물 크롭)

types/
  database.ts       → Supabase 자동생성 타입 (supabase gen types)
```

---

## 코딩 규칙
1. 모든 파일은 TypeScript (`.tsx`, `.ts`)
2. 서버 컴포넌트 우선, 클라이언트는 꼭 필요할 때만 `"use client"`
3. Supabase 타입은 `types/database.ts`에서 import
4. 에러 처리: try-catch + toast 알림
5. 모든 DB 접근은 Supabase RLS(Row Level Security) 준수
6. 금액은 항상 원 단위 정수(BIGINT), 표시만 포맷팅
7. PDF 관련 코드는 서버 전용 (`app/api/reports/generate/` 또는 `components/reports/`)

### ✅ Phase 3 — P4 외부감사 리스크 가중치 (`POST /api/pattern-analysis`)
- 분석 실행 전 최근 2개년 `external_audits` + `audit_findings(source='external')` 조회
- ACFE 카테고리 빈도 집계 → Top 3 고위험 카테고리 추출
- 시계열 이상탐지: 고위험 시 ±2σ → ±1.5σ (`재무제표부정·자산횡령·가공거래` 해당)
- 거래처 집중도: 고위험 시 30% → 20% (`자산횡령·부패` 해당)
- finding description에 `[외부감사가중치적용]` 태그 자동 부착
- 응답에 `externalAuditRiskWeighting` 섹션 포함 (카테고리·조정값·사유)

### ✅ Phase 3 — 외부 회계감사 (`/external-audits`)
- 외부감사 보고서 등록 (회계법인·담당 CPA·감사일·감사 의견)
- PDF 업로드 → Supabase Storage (`external-audits` 버킷, 비공개) → SHA-256 해시 자동 계산
- 지적사항 일괄 입력 폼 (동적 행 추가, ACFE 분류 연계)
- `audit_findings` 테이블에 `source='external'`, `external_audit_id` 연결 저장
- KPI: 최근 감사 의견 / 누적 감사 건수 / 적정 의견 비율
- REST API: `GET /api/external-audits` (연도 필터), `POST /api/external-audits` (감사+지적사항 일괄)

---

## 미완성 (Phase 3 예정)
- [x] P4 Benford's Law + ACFE 패턴 분석 (`POST /api/pattern-analysis` — 6종 탐지, audit_findings 자동 등록)
- [x] P4 외부감사 리스크 가중치 (`/api/pattern-analysis` — 최근 2개년 외부감사 ACFE 빈도 집계 → Top 3 고위험 카테고리 시 ±2σ→±1.5σ, 거래처 집중도 30%→20% 자동 강화)
- [x] K-apt 유사단지 관리비 비교 (`GET/POST /api/kapt` — 공공API, kapt_comparison 테이블, 대시보드 RadarChart, [평균초과] 배지)
- [x] 외부 회계감사 (`/external-audits` — 보고서 등록, PDF+해시, 지적사항 연계)
- [x] 사용자 관리 (`/settings/users` — auditor 전용, 역할 인라인 변경, 초대 발송)
- [x] UI 리디자인 (slate/blue 프리미엄 톤, 글라스 로그인, KPI 카드 섀도)
- [ ] 공개 포털 (입주민 열람용)
- [ ] 계약 비교 분석 (낙찰률·단가 이상 탐지)
- [ ] 모바일 최적화
