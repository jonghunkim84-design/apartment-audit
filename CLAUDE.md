@AGENTS.md

# Apartment Audit System (AAS) — Claude Code 가이드

## 프로젝트 개요
아파트 입주자대표회의 감사 역할자를 위한 디지털 감사 플랫폼.
영수증 자동 검증, 관리비 이상 탐지, 감사 보고서 자동 생성이 핵심 기능.

## 기술 스택
- Framework: Next.js 14 (App Router, TypeScript)
- Database/Auth/Storage: Supabase (PostgreSQL)
- UI: shadcn/ui + Tailwind CSS
- Charts: Recharts
- Table: TanStack Table
- Form: React Hook Form + Zod
- State: TanStack Query (서버), Zustand (클라이언트)
- AI: Google Gemini API (gemini-2.5-flash, 멀티모달 OCR + 13요소 파싱 + 정책 필터)
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

## 폴더 구조
app/
  (auth)/         → 로그인 페이지
  dashboard/      → 메인 대시보드
  receipts/       → 영수증 목록·검수
  audit/          → 감사 체크리스트
  reports/        → 보고서 생성
  contracts/      → 계약·입찰 관리
  misc-income/    → 잡수입 관리
api/
  receipts/       → 영수증 처리 API
  ocr/            → Google Vision + Claude 파이프라인
  reports/        → 보고서 생성 API
components/
  ui/             → shadcn 컴포넌트 (건드리지 말 것)
  receipts/       → 영수증 관련 컴포넌트
  dashboard/      → 대시보드 컴포넌트
lib/
  supabase/       → Supabase 클라이언트
  validations/    → Zod 스키마
  utils.ts        → 유틸리티 함수
types/
  database.ts     → Supabase 자동생성 타입 (supabase gen types)

## 코딩 규칙
1. 모든 파일은 TypeScript (.tsx, .ts)
2. 서버 컴포넌트 우선, 클라이언트는 꼭 필요할 때만 "use client"
3. Supabase 타입은 types/database.ts에서 import
4. 에러 처리: try-catch + toast 알림
5. 모든 DB 접근은 Supabase RLS(Row Level Security) 준수
6. 금액은 항상 원 단위 정수(BIGINT), 표시만 포맷팅

## 현재 개발 상태
- [ ] Phase 1 MVP (영수증 검증, 기본 대시보드)
- [ ] Phase 2 확장 (체크리스트, 잡수입, 보고서)
- [ ] Phase 3 고도화 (AI 패턴 분석, 공개 포털)
