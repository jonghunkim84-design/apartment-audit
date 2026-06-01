// 'use server' 없이 상수/타입만 정의 — 클라이언트·서버 양쪽에서 import 가능

export type ChecklistItem = { id: string; section: string; label: string; checked: boolean }

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  // Section A — 단지 현황
  { id: 'a1', section: 'A', label: '진행 중 액션 목록 정리 및 이관',       checked: false },
  { id: 'a2', section: 'A', label: '진행 중 공사·계약 현황 입력 완료',       checked: false },
  { id: 'a3', section: 'A', label: '주요 업체·기관 연락처 확인 및 이관',     checked: false },
  // Section B — 시스템 접근 권한
  { id: 'b1', section: 'B', label: '카카오 단체방 관리자 권한 이전',         checked: false },
  { id: 'b2', section: 'B', label: '구글 드라이브 접근 권한 이전',           checked: false },
  { id: 'b3', section: 'B', label: '신임 동대표 시스템 계정 생성 완료',      checked: false },
  // Section C — 문서 인계
  { id: 'c1', section: 'C', label: '관리규약 최신본 전달',                   checked: false },
  { id: 'c2', section: 'C', label: '장기수선계획 최신본 전달',               checked: false },
  { id: 'c3', section: 'C', label: 'P2 회의록 표준 운영 매뉴얼 전달',       checked: false },
  // Section D — 미해결 사항
  { id: 'd1', section: 'D', label: '컴플 즉시 시정 미완료 항목 전달',       checked: false },
  { id: 'd2', section: 'D', label: '진행 중 장기 공사·용역 현황 전달',      checked: false },
  { id: 'd3', section: 'D', label: '반복 민원 현황 전달',                   checked: false },
]
