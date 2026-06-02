-- ============================================================
-- 대표회의 운영 시스템 2단계 — 분기·연간 리포트 테이블
-- ============================================================

-- 분기 리포트
CREATE TABLE IF NOT EXISTS council_quarterly_reports (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_complex_id         UUID NOT NULL REFERENCES apartment_complexes(id) ON DELETE CASCADE,
  year                         INTEGER NOT NULL,
  quarter                      INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  -- KPI 4종
  kpi_avg_decision_days        NUMERIC,       -- 평균 결정 소요일
  kpi_24h_rule_rate            NUMERIC,       -- 24시간 룰 준수율 %
  kpi_minutes_published_rate   NUMERIC,       -- 회의록 24시간 공개율 %
  kpi_action_completion_rate   NUMERIC,       -- 액션 완료율 %
  kpi_overdue_count            INTEGER,       -- 지연 액션 건수
  kpi_escalation_count         INTEGER,       -- 에스컬 발동 건수
  -- 컴플 6항목 (pass / partial / fail)
  comp_minutes_retention       TEXT DEFAULT 'pass',   -- 회의록 5년 보관
  comp_recording_consent       TEXT DEFAULT 'pass',   -- 녹음 동의
  comp_privacy_masking         TEXT DEFAULT 'pass',   -- 개인정보 마스킹
  comp_long_term_repair        TEXT DEFAULT 'pass',   -- 장기수선충당금 집행
  comp_large_work_approval     TEXT DEFAULT 'pass',   -- 500만 초과 의결
  comp_public_disclosure       TEXT DEFAULT 'pass',   -- 24시간 공개
  -- AI 분석
  ai_strengths                 JSONB,         -- 강점 배열
  ai_improvements              JSONB,         -- 보강 권고 배열
  ai_recommendations           JSONB,         -- 차분기 권고 배열
  -- 집계 기준
  meeting_count                INTEGER DEFAULT 0,
  total_actions                INTEGER DEFAULT 0,
  completed_actions            INTEGER DEFAULT 0,
  -- 상태
  generated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by                  UUID REFERENCES profiles(id),
  UNIQUE (apartment_complex_id, year, quarter)
);

ALTER TABLE council_quarterly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "council_qr_policy" ON council_quarterly_reports;
CREATE POLICY "council_qr_policy" ON council_quarterly_reports
  USING (apartment_complex_id = auth_apartment_complex_id());

CREATE INDEX IF NOT EXISTS idx_council_qr_complex ON council_quarterly_reports(apartment_complex_id);
CREATE INDEX IF NOT EXISTS idx_council_qr_year ON council_quarterly_reports(year, quarter);
