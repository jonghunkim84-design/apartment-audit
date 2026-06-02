-- ============================================================
-- 입주자대표회의 운영 관리 시스템 스키마
-- apartment-audit-system 통합 버전
-- ============================================================

-- 회기 (2년 임기 단위)
CREATE TABLE IF NOT EXISTS council_terms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_complex_id UUID NOT NULL REFERENCES apartment_complexes(id) ON DELETE CASCADE,
  term_number   INTEGER NOT NULL,          -- 몇 기
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (apartment_complex_id, term_number)
);

-- 회의
CREATE TABLE IF NOT EXISTS council_meetings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_complex_id        UUID NOT NULL REFERENCES apartment_complexes(id) ON DELETE CASCADE,
  term_id                     UUID REFERENCES council_terms(id),
  title                       TEXT NOT NULL,
  meeting_type                TEXT NOT NULL CHECK (meeting_type IN (
                                'regular',        -- 정기 전체대표회의
                                'subcommittee',   -- 소위원회
                                'emergency',      -- 긴급회의
                                'ops',            -- 운영위원회
                                'one_on_one'      -- 관리소장 1:1
                              )),
  held_at                     TIMESTAMPTZ NOT NULL,
  location                    TEXT,
  quorum_required             INTEGER,            -- 의결 정족수
  quorum_present              INTEGER,            -- 실제 참석
  quorum_met                  BOOLEAN,
  recording_consent_confirmed BOOLEAN NOT NULL DEFAULT false,
  status                      TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
                                'scheduled', 'in_progress', 'completed', 'cancelled'
                              )),
  raw_transcript              TEXT,               -- 클로바노트 전사 원문
  created_by                  UUID REFERENCES profiles(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 회의록 (4단 표준)
CREATE TABLE IF NOT EXISTS council_meeting_minutes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id          UUID NOT NULL UNIQUE REFERENCES council_meetings(id) ON DELETE CASCADE,
  agenda_summary      JSONB,                      -- 1단: 안건 요약
  discussion_summary  JSONB,                      -- 2단: 논의 핵심
  ai_generated_at     TIMESTAMPTZ,
  reviewed_by         UUID REFERENCES profiles(id),
  reviewed_at         TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,                -- 공개 게시 시각
  pdf_url             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 결정사항 (Drucker 5단계)
CREATE TABLE IF NOT EXISTS council_decisions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id        UUID NOT NULL REFERENCES council_meetings(id) ON DELETE CASCADE,
  agenda_type       TEXT CHECK (agenda_type IN ('info', 'discussion', 'decision', 'review')),
  title             TEXT NOT NULL,
  d1_classification TEXT CHECK (d1_classification IN ('general', 'exception', 'crisis')),
  d2_definition     TEXT,                         -- 무엇을 결정
  d3_criteria       TEXT,                         -- 만족 조건
  d4_execution      TEXT,                         -- 누가/언제/어떻게
  d5_feedback       TEXT,                         -- 검증 시점·방법
  legal_type        TEXT CHECK (legal_type IN (
                      'manager_only',             -- 관리소장 자율
                      'president_approval',        -- 대표회장 승인
                      'full_council',              -- 전체대표회의 의결
                      'legal_procedure'            -- 법정 절차
                    )),
  order_index       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 액션 (모니터링 핵심)
CREATE TABLE IF NOT EXISTS council_actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_complex_id UUID NOT NULL REFERENCES apartment_complexes(id) ON DELETE CASCADE,
  meeting_id          UUID REFERENCES council_meetings(id),
  decision_id         UUID REFERENCES council_decisions(id),
  title               TEXT NOT NULL,
  description         TEXT,
  assignee_id         UUID REFERENCES profiles(id),
  assignee_name       TEXT,                        -- 직책 텍스트 (비회원 포함)
  due_date            DATE NOT NULL,
  verification_method TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                        'pending', 'in_progress', 'completed', 'overdue', 'cancelled'
                      )),
  -- 에스컬레이션
  escalated           BOOLEAN NOT NULL DEFAULT false,
  escalated_at        TIMESTAMPTZ,
  escalated_to        UUID REFERENCES profiles(id),
  -- 완료 처리
  completed_at        TIMESTAMPTZ,
  completed_by        UUID REFERENCES profiles(id),
  completion_note     TEXT,
  -- 연간 이월
  carried_over_from   UUID REFERENCES council_actions(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS 정책
-- ============================================================

ALTER TABLE council_terms           ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_meetings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_decisions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_actions         ENABLE ROW LEVEL SECURITY;

-- 같은 단지 구성원만 접근
DROP POLICY IF EXISTS "council_terms_policy"   ON council_terms;
DROP POLICY IF EXISTS "council_meetings_policy" ON council_meetings;
DROP POLICY IF EXISTS "council_minutes_policy"  ON council_meeting_minutes;
DROP POLICY IF EXISTS "council_decisions_policy" ON council_decisions;
DROP POLICY IF EXISTS "council_actions_policy"  ON council_actions;

CREATE POLICY "council_terms_policy" ON council_terms
  USING (apartment_complex_id = auth_apartment_complex_id());

CREATE POLICY "council_meetings_policy" ON council_meetings
  USING (apartment_complex_id = auth_apartment_complex_id());

CREATE POLICY "council_minutes_policy" ON council_meeting_minutes
  USING (
    meeting_id IN (
      SELECT id FROM council_meetings
      WHERE apartment_complex_id = auth_apartment_complex_id()
    )
  );

CREATE POLICY "council_decisions_policy" ON council_decisions
  USING (
    meeting_id IN (
      SELECT id FROM council_meetings
      WHERE apartment_complex_id = auth_apartment_complex_id()
    )
  );

CREATE POLICY "council_actions_policy" ON council_actions
  USING (apartment_complex_id = auth_apartment_complex_id());

-- ============================================================
-- 인덱스
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_council_meetings_complex    ON council_meetings(apartment_complex_id);
CREATE INDEX IF NOT EXISTS idx_council_meetings_held_at    ON council_meetings(held_at DESC);
CREATE INDEX IF NOT EXISTS idx_council_actions_complex     ON council_actions(apartment_complex_id);
CREATE INDEX IF NOT EXISTS idx_council_actions_status      ON council_actions(status);
CREATE INDEX IF NOT EXISTS idx_council_actions_due_date    ON council_actions(due_date);
CREATE INDEX IF NOT EXISTS idx_council_actions_assignee    ON council_actions(assignee_id);
CREATE INDEX IF NOT EXISTS idx_council_decisions_meeting   ON council_decisions(meeting_id);
