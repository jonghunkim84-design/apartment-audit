-- ============================================================
-- 공개 포털용 RLS 정책 — 로그인 없이 공개된 회의록 열람
-- Supabase SQL Editor에서 실행
-- ============================================================

-- council_meetings: 공개 회의록이 있는 회의만 anon 열람 허용
DROP POLICY IF EXISTS "council_meetings_anon_published" ON council_meetings;
CREATE POLICY "council_meetings_anon_published" ON council_meetings
  FOR SELECT
  TO anon
  USING (
    id IN (
      SELECT meeting_id FROM council_meeting_minutes WHERE published_at IS NOT NULL
    )
  );

-- council_meeting_minutes: published_at이 있는 회의록만 anon 열람 허용
DROP POLICY IF EXISTS "council_minutes_anon_published" ON council_meeting_minutes;
CREATE POLICY "council_minutes_anon_published" ON council_meeting_minutes
  FOR SELECT
  TO anon
  USING (published_at IS NOT NULL);

-- council_decisions: 공개된 회의의 결정사항만 anon 열람 허용
DROP POLICY IF EXISTS "council_decisions_anon_published" ON council_decisions;
CREATE POLICY "council_decisions_anon_published" ON council_decisions
  FOR SELECT
  TO anon
  USING (
    meeting_id IN (
      SELECT meeting_id FROM council_meeting_minutes WHERE published_at IS NOT NULL
    )
  );
