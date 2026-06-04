-- council_actions 에스컬레이션 상세 컬럼 추가
ALTER TABLE council_actions
  ADD COLUMN IF NOT EXISTS escalation_reason       TEXT,
  ADD COLUMN IF NOT EXISTS escalation_response     TEXT,
  ADD COLUMN IF NOT EXISTS escalation_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_by            UUID REFERENCES profiles(id);
