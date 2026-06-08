-- 보류(Defer) 안건 기능 지원
-- council_decisions에 agenda_type 'deferred' 추가 및 보류 관련 컬럼 추가

-- 1. agenda_type CHECK 제약 갱신 (deferred 추가)
ALTER TABLE council_decisions
  DROP CONSTRAINT IF EXISTS council_decisions_agenda_type_check;
ALTER TABLE council_decisions
  ADD CONSTRAINT council_decisions_agenda_type_check
  CHECK (agenda_type IN ('info', 'discussion', 'decision', 'review', 'deferred'));

-- 2. 보류 사유 및 다음 협의 예정일 컬럼 추가
ALTER TABLE council_decisions
  ADD COLUMN IF NOT EXISTS deferred_reason          TEXT,
  ADD COLUMN IF NOT EXISTS deferred_next_meeting_at DATE;
