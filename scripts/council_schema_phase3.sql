-- ============================================================
-- 대표회의 운영 시스템 3단계 — 인수인계 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS council_handovers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apartment_complex_id     UUID NOT NULL REFERENCES apartment_complexes(id) ON DELETE CASCADE,
  handover_date            DATE NOT NULL,
  -- 체크리스트 (항목별 완료 여부 JSONB 배열)
  checklist                JSONB NOT NULL DEFAULT '[]',
  -- 진행 중 공사·계약 현황
  ongoing_works            TEXT,
  -- 주요 업체·기관 연락처
  key_contacts             TEXT,
  -- 인계 메모 (특이사항)
  notes                    TEXT,
  -- 완료 처리
  completed_by             UUID REFERENCES profiles(id),
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE council_handovers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "council_handovers_policy" ON council_handovers;
CREATE POLICY "council_handovers_policy" ON council_handovers
  USING (apartment_complex_id = auth_apartment_complex_id());

CREATE INDEX IF NOT EXISTS idx_council_handovers_complex
  ON council_handovers(apartment_complex_id);
