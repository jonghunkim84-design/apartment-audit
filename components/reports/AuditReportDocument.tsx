import React from 'react'
import path from 'path'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { ReportData } from '@/lib/actions/report-data'

const fontsDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'NotoSansKR',
  fonts: [
    { src: path.join(fontsDir, 'noto-sans-kr-korean-400-normal.woff'), fontWeight: 400 },
    { src: path.join(fontsDir, 'noto-sans-kr-korean-700-normal.woff'), fontWeight: 700 },
  ],
})

const FONT = 'NotoSansKR'

const s = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 9,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    color: '#1a1a1a',
  },
  coverPage: {
    fontFamily: FONT,
    fontSize: 9,
    paddingTop: 80,
    paddingBottom: 80,
    paddingHorizontal: 60,
    color: '#1a1a1a',
  },
  // Cover
  coverTitle: {
    fontSize: 22,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 2,
  },
  coverSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#555',
    marginBottom: 60,
  },
  coverInfoBox: {
    border: '1pt solid #999',
    borderRadius: 4,
    padding: 24,
    marginBottom: 40,
  },
  coverInfoRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  coverInfoLabel: {
    width: 100,
    fontWeight: 700,
    color: '#444',
  },
  coverInfoValue: {
    flex: 1,
  },
  coverLawNote: {
    fontSize: 8,
    color: '#888',
    textAlign: 'center',
    marginBottom: 60,
  },
  signatureSection: {
    marginTop: 'auto',
    borderTop: '1pt solid #ccc',
    paddingTop: 20,
  },
  signatureTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 16,
    textAlign: 'center',
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signatureBox: {
    width: 180,
    borderBottom: '1pt solid #333',
    paddingBottom: 4,
    paddingTop: 30,
    alignItems: 'center',
  },
  signatureLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 4,
  },
  // Section header
  sectionHeader: {
    backgroundColor: '#1e3a5f',
    color: '#fff',
    fontWeight: 700,
    fontSize: 11,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    marginTop: 16,
  },
  subSectionHeader: {
    backgroundColor: '#e8edf2',
    fontWeight: 700,
    fontSize: 9,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 10,
    borderLeft: '3pt solid #1e3a5f',
  },
  // KPI grid
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    border: '1pt solid #ddd',
    borderRadius: 3,
    padding: 10,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
  },
  kpiValueRed: {
    fontSize: 14,
    fontWeight: 700,
    color: '#c0392b',
    textAlign: 'center',
  },
  kpiSub: {
    fontSize: 7,
    color: '#888',
    marginTop: 2,
    textAlign: 'center',
  },
  // Table
  table: {
    borderTop: '1pt solid #999',
    borderLeft: '1pt solid #999',
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #999',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1pt solid #999',
    backgroundColor: '#f7f8fa',
  },
  tableHead: {
    flexDirection: 'row',
    borderBottom: '1.5pt solid #333',
    backgroundColor: '#f0f3f7',
  },
  tableCell: {
    borderRight: '1pt solid #999',
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 8,
  },
  tableCellHeader: {
    borderRight: '1pt solid #999',
    paddingVertical: 5,
    paddingHorizontal: 5,
    fontSize: 8,
    fontWeight: 700,
  },
  // Misc
  noData: {
    color: '#aaa',
    fontSize: 8,
    fontStyle: 'italic',
    paddingVertical: 8,
    paddingHorizontal: 10,
    border: '1pt solid #eee',
    marginBottom: 8,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#aaa',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#bbb',
    borderTop: '0.5pt solid #e0e0e0',
    paddingTop: 6,
  },
})

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n) + '원'
}

function fmtDate(d: string | null) {
  if (!d) return '-'
  return d.slice(0, 10)
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    manual_review: '수동검수',
    rejected: '반려',
    approved: '승인',
    pending: '대기',
    processing: '처리중',
    SENT: '발송',
    RECEIVED: '접수',
    RESOLVED: '처리완료',
    ESCALATED: '에스컬레이션',
    open: '열림',
    investigating: '조사중',
    resolved: '해결',
    false_positive: '오탐',
  }
  return m[s] ?? s
}

function severityLabel(s: string) {
  return (
    { critical: '위험', high: '높음', medium: '중간', low: '낮음' }[s] ?? s
  )
}

function sanitizeText(s: string): string {
  // ₩ (U+20A9, U+FFE6) → '원' — 한글 폰트 서브셋 미지원 문자 치환
  return s.replace(/[₩￦]/g, '원').replace(/©/g, '원')
}

function categoryLabel(c: string) {
  const m: Record<string, string> = {
    recycling: '재활용품',
    parking: '주차장',
    rental: '임대',
    interest: '이자',
    penalty: '연체료',
    other: '기타',
  }
  return m[c] ?? c
}

function parsePolicyFlags(flags: unknown): string {
  if (!flags) return '-'
  try {
    if (typeof flags === 'string') {
      const parsed = JSON.parse(flags)
      if (Array.isArray(parsed)) return parsed.join(', ')
      return JSON.stringify(parsed)
    }
    if (Array.isArray(flags)) return flags.join(', ')
    if (typeof flags === 'object') {
      const f = flags as Record<string, unknown>
      return Object.entries(f)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ')
    }
    return String(flags)
  } catch {
    return String(flags)
  }
}

function PageFooter({ apartment, period }: { apartment: string; period: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{apartment} | 감사 기간: {period}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

export function AuditReportDocument({ data }: { data: ReportData }) {
  const period = `${data.period.from} ~ ${data.period.to}`
  const generatedDate = fmtDate(data.generatedAt)

  return (
    <Document
      title={`${data.apartment.name} 감사보고서 (${period})`}
      author={data.auditor.full_name ?? '감사'}
      subject="공동주택관리법 제26조 감사 보고서"
    >
      {/* ── 표지 ── */}
      <Page size="A4" style={s.coverPage}>
        <Text style={s.coverTitle}>공동주택 감사 보고서</Text>
        <Text style={s.coverSubtitle}>Apartment Audit Report</Text>

        <View style={s.coverInfoBox}>
          <View style={s.coverInfoRow}>
            <Text style={s.coverInfoLabel}>아파트 명칭</Text>
            <Text style={s.coverInfoValue}>{data.apartment.name}</Text>
          </View>
          <View style={s.coverInfoRow}>
            <Text style={s.coverInfoLabel}>주소</Text>
            <Text style={s.coverInfoValue}>{data.apartment.address ?? '-'}</Text>
          </View>
          <View style={s.coverInfoRow}>
            <Text style={s.coverInfoLabel}>세대수</Text>
            <Text style={s.coverInfoValue}>
              {data.apartment.unit_count ? `${data.apartment.unit_count.toLocaleString()}세대` : '-'}
            </Text>
          </View>
          <View style={s.coverInfoRow}>
            <Text style={s.coverInfoLabel}>감사 기간</Text>
            <Text style={s.coverInfoValue}>{period}</Text>
          </View>
          <View style={s.coverInfoRow}>
            <Text style={s.coverInfoLabel}>감사인</Text>
            <Text style={s.coverInfoValue}>{data.auditor.full_name ?? '-'}</Text>
          </View>
          <View style={s.coverInfoRow}>
            <Text style={s.coverInfoLabel}>보고서 작성일</Text>
            <Text style={s.coverInfoValue}>{generatedDate}</Text>
          </View>
        </View>

        <Text style={s.coverLawNote}>
          본 보고서는 공동주택관리법 제26조(관리비 등의 공개) 및 동법 시행규칙에 따라 작성되었습니다.
        </Text>

        <View style={s.signatureSection}>
          <Text style={s.signatureTitle}>서명란 (Signature)</Text>
          <View style={s.signatureRow}>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>감사인 서명</Text>
              <Text style={{ fontSize: 8, color: '#888' }}>{data.auditor.full_name ?? ''}</Text>
              <Text style={{ fontSize: 7, color: '#aaa', marginTop: 2 }}>(인)</Text>
            </View>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>입주자대표회의 의장 확인</Text>
              <Text style={{ fontSize: 8, color: '#888' }}> </Text>
              <Text style={{ fontSize: 7, color: '#aaa', marginTop: 2 }}>(인)</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ── 본문 ── */}
      <Page size="A4" style={s.page}>
        <PageFooter apartment={data.apartment.name} period={period} />

        {/* Section 1: 감사 결과 요약 */}
        <Text style={s.sectionHeader}>제1장  감사 결과 요약</Text>

        <View style={s.kpiGrid}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>총 영수증</Text>
            <Text style={s.kpiValue}>{data.receipts.total.toLocaleString()}</Text>
            <Text style={s.kpiSub}>건</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>이상 건수</Text>
            <Text style={data.receipts.flagged > 0 ? s.kpiValueRed : s.kpiValue}>
              {data.receipts.flagged.toLocaleString()}
            </Text>
            <Text style={s.kpiSub}>건 (수동검수+반려)</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>총 지출 금액</Text>
            <Text style={s.kpiValue}>{fmtKRW(data.receipts.totalAmount)}</Text>
            <Text style={s.kpiSub}>기간 합계</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>감사 지적사항</Text>
            <Text style={data.findings.length > 0 ? s.kpiValueRed : s.kpiValue}>
              {data.findings.length}
            </Text>
            <Text style={s.kpiSub}>건</Text>
          </View>
        </View>

        <View style={[s.table, { marginTop: 4 }]}>
          <View style={s.tableHead}>
            <Text style={[s.tableCellHeader, { flex: 1 }]}>감사 항목</Text>
            <Text style={[s.tableCellHeader, { width: 80, textAlign: 'right' }]}>결과</Text>
            <Text style={[s.tableCellHeader, { width: 120 }]}>비고</Text>
          </View>
          {[
            ['영수증 총 건수', `${data.receipts.total}건`, ''],
            ['이상 건수 (수동검수)', `${data.receipts.flagged}건`, data.receipts.flagged > 0 ? '상세 2장 참조' : '이상 없음'],
            ['총 지출 금액', fmtKRW(data.receipts.totalAmount), ''],
            ['감사 지적사항', `${data.findings.length}건`, data.findings.length > 0 ? '상세 3장 참조' : '이상 없음'],
            ['재심의 요청', `${data.reconsiderations.length}건`, '상세 4장 참조'],
            ['잡수입 합계', fmtKRW(data.miscIncome.total), `미수납 ${data.miscIncome.pendingCount}건`],
            ['장기수선충당금 이행률', `${data.longTermRepair.executionRate}%`, data.longTermRepair.unplannedCount > 0 ? `미계획 지출 ${data.longTermRepair.unplannedCount}건` : ''],
          ].map(([item, result, note], i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCell, { flex: 1 }]}>{item}</Text>
              <Text style={[s.tableCell, { width: 80, textAlign: 'right' }]}>{result}</Text>
              <Text style={[s.tableCell, { width: 120 }]}>{note}</Text>
            </View>
          ))}
        </View>

        {/* Section 2: 영수증 이상 건 상세 */}
        <Text style={s.sectionHeader}>제2장  영수증 이상 건 상세 목록</Text>
        <Text style={s.subSectionHeader}>■ 수동검수 및 반려 처리 영수증</Text>

        {data.flaggedReceipts.length === 0 ? (
          <Text style={s.noData}>해당 기간 내 이상 건이 없습니다.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.tableCellHeader, { width: 65 }]}>영수증 날짜</Text>
              <Text style={[s.tableCellHeader, { flex: 1 }]}>거래처</Text>
              <Text style={[s.tableCellHeader, { width: 70, textAlign: 'right' }]}>금액</Text>
              <Text style={[s.tableCellHeader, { width: 55 }]}>처리 상태</Text>
              <Text style={[s.tableCellHeader, { width: 80 }]}>이상 유형</Text>
              <Text style={[s.tableCellHeader, { flex: 1 }]}>처리 내용</Text>
            </View>
            {data.flaggedReceipts.map((r, i) => (
              <View key={r.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: 65 }]}>{fmtDate(r.receipt_date)}</Text>
                <Text style={[s.tableCell, { flex: 1 }]}>{r.merchant_name ?? '-'}</Text>
                <Text style={[s.tableCell, { width: 70, textAlign: 'right' }]}>
                  {r.amount != null ? fmtKRW(r.amount) : '-'}
                </Text>
                <Text style={[s.tableCell, { width: 55 }]}>{statusLabel(r.status)}</Text>
                <Text style={[s.tableCell, { width: 80 }]}>{parsePolicyFlags(r.policy_flags)}</Text>
                <Text style={[s.tableCell, { flex: 1 }]}>{r.review_note ?? '-'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Section 3: 감사 지적사항 */}
        <Text style={s.sectionHeader}>제3장  감사 지적사항</Text>
        <Text style={s.subSectionHeader}>■ audit_findings 등록 목록</Text>

        {data.findings.length === 0 ? (
          <Text style={s.noData}>해당 기간 내 감사 지적사항이 없습니다.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.tableCellHeader, { width: 65 }]}>등록일</Text>
              <Text style={[s.tableCellHeader, { flex: 1.5 }]}>제목</Text>
              <Text style={[s.tableCellHeader, { flex: 2 }]}>내용</Text>
              <Text style={[s.tableCellHeader, { width: 45 }]}>심각도</Text>
              <Text style={[s.tableCellHeader, { width: 55 }]}>처리상태</Text>
            </View>
            {data.findings.map((f, i) => (
              <View key={f.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: 65 }]}>{fmtDate(f.created_at)}</Text>
                <Text style={[s.tableCell, { flex: 1.5 }]}>{sanitizeText(f.title)}</Text>
                <Text style={[s.tableCell, { flex: 2 }]}>{f.description ? sanitizeText(f.description) : '-'}</Text>
                <Text style={[s.tableCell, { width: 45 }]}>{severityLabel(f.severity)}</Text>
                <Text style={[s.tableCell, { width: 55 }]}>{statusLabel(f.status)}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>

      {/* ── 본문 2 ── */}
      <Page size="A4" style={s.page}>
        <PageFooter apartment={data.apartment.name} period={period} />

        {/* Section 4: 재심의 요청 */}
        <Text style={s.sectionHeader}>제4장  재심의 요청 내역 및 처리 결과</Text>

        {data.reconsiderations.length === 0 ? (
          <Text style={s.noData}>해당 기간 내 재심의 요청이 없습니다.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.tableCellHeader, { width: 65 }]}>요청일</Text>
              <Text style={[s.tableCellHeader, { width: 90 }]}>법적 근거</Text>
              <Text style={[s.tableCellHeader, { flex: 2 }]}>요청 내용</Text>
              <Text style={[s.tableCellHeader, { width: 55 }]}>상태</Text>
              <Text style={[s.tableCellHeader, { width: 65 }]}>처리일</Text>
              <Text style={[s.tableCellHeader, { flex: 2 }]}>처리 결과</Text>
            </View>
            {data.reconsiderations.map((r, i) => (
              <View key={r.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.tableCell, { width: 65 }]}>{fmtDate(r.sent_at)}</Text>
                <Text style={[s.tableCell, { width: 90 }]}>{sanitizeText(r.law_reference)}</Text>
                <Text style={[s.tableCell, { flex: 2 }]}>{sanitizeText(r.content)}</Text>
                <Text style={[s.tableCell, { width: 55 }]}>{statusLabel(r.status)}</Text>
                <Text style={[s.tableCell, { width: 65 }]}>{fmtDate(r.resolved_at)}</Text>
                <Text style={[s.tableCell, { flex: 2 }]}>{r.resolution ? sanitizeText(r.resolution) : '-'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Section 5: 잡수입 */}
        <Text style={s.sectionHeader}>제5장  잡수입 유형별 현황</Text>

        <View style={s.kpiGrid}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>잡수입 합계</Text>
            <Text style={s.kpiValue}>{fmtKRW(data.miscIncome.total)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>미수납 건수</Text>
            <Text style={data.miscIncome.pendingCount > 0 ? s.kpiValueRed : s.kpiValue}>
              {data.miscIncome.pendingCount}
            </Text>
            <Text style={s.kpiSub}>건</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={[s.tableCellHeader, { flex: 1 }]}>수입 유형</Text>
            <Text style={[s.tableCellHeader, { width: 120, textAlign: 'right' }]}>합계 금액</Text>
            <Text style={[s.tableCellHeader, { width: 80, textAlign: 'right' }]}>비율</Text>
          </View>
          {Object.entries(data.miscIncome.byCategory).map(([cat, amt], i) => (
            <View key={cat} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCell, { flex: 1 }]}>{categoryLabel(cat)}</Text>
              <Text style={[s.tableCell, { width: 120, textAlign: 'right' }]}>{fmtKRW(amt)}</Text>
              <Text style={[s.tableCell, { width: 80, textAlign: 'right' }]}>
                {data.miscIncome.total > 0
                  ? `${Math.round((amt / data.miscIncome.total) * 100)}%`
                  : '-'}
              </Text>
            </View>
          ))}
          {Object.keys(data.miscIncome.byCategory).length === 0 && (
            <View style={s.tableRow}>
              <Text style={[s.tableCell, { flex: 1, color: '#aaa' }]}>데이터 없음</Text>
            </View>
          )}
          <View style={[s.tableRow, { backgroundColor: '#e8edf2' }]}>
            <Text style={[s.tableCellHeader, { flex: 1 }]}>합계</Text>
            <Text style={[s.tableCellHeader, { width: 120, textAlign: 'right' }]}>
              {fmtKRW(data.miscIncome.total)}
            </Text>
            <Text style={[s.tableCellHeader, { width: 80, textAlign: 'right' }]}>100%</Text>
          </View>
        </View>

        {/* Section 6: 장기수선충당금 */}
        <Text style={s.sectionHeader}>제6장  장기수선충당금 이행 현황</Text>

        <View style={s.kpiGrid}>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>계획 금액</Text>
            <Text style={s.kpiValue}>{fmtKRW(data.longTermRepair.totalPlanned)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>실행 금액</Text>
            <Text style={s.kpiValue}>{fmtKRW(data.longTermRepair.totalActual)}</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>이행률</Text>
            <Text
              style={
                data.longTermRepair.executionRate < 80 ? s.kpiValueRed : s.kpiValue
              }
            >
              {data.longTermRepair.executionRate}%
            </Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiLabel}>미계획 지출</Text>
            <Text
              style={data.longTermRepair.unplannedCount > 0 ? s.kpiValueRed : s.kpiValue}
            >
              {data.longTermRepair.unplannedCount}
            </Text>
            <Text style={s.kpiSub}>건</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={[s.tableCellHeader, { flex: 1 }]}>항목</Text>
            <Text style={[s.tableCellHeader, { width: 160, textAlign: 'right' }]}>금액</Text>
            <Text style={[s.tableCellHeader, { width: 100 }]}>비고</Text>
          </View>
          {[
            ['계획 금액', fmtKRW(data.longTermRepair.totalPlanned), '연간 장기수선계획 기준'],
            ['실행 금액', fmtKRW(data.longTermRepair.totalActual), '실제 집행액'],
            [
              '차액',
              fmtKRW(data.longTermRepair.totalActual - data.longTermRepair.totalPlanned),
              data.longTermRepair.totalActual >= data.longTermRepair.totalPlanned ? '초과' : '미달',
            ],
            ['이행률', `${data.longTermRepair.executionRate}%`, data.longTermRepair.executionRate < 80 ? '▲ 이행률 부족' : '적정'],
            ['미계획 지출 건수', `${data.longTermRepair.unplannedCount}건`, '계획 외 지출 항목'],
          ].map(([item, val, note], i) => (
            <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCell, { flex: 1 }]}>{item}</Text>
              <Text style={[s.tableCell, { width: 160, textAlign: 'right' }]}>{val}</Text>
              <Text style={[s.tableCell, { width: 100 }]}>{note}</Text>
            </View>
          ))}
        </View>

        {/* 서명란 */}
        <View style={{ marginTop: 30, borderTop: '1pt solid #ccc', paddingTop: 16 }}>
          <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
            감사인 최종 확인
          </Text>
          <Text style={{ fontSize: 8, color: '#555', marginBottom: 20, lineHeight: 1.6 }}>
            본인은 위 감사 보고서가 공동주택관리법 제26조에 따라 적법하게 작성되었음을 확인합니다.{'\n'}
            감사 기간: {period} | 작성일: {generatedDate}
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <View style={{ width: 200 }}>
              <Text style={{ fontSize: 8, color: '#666', marginBottom: 4 }}>감사인</Text>
              <Text style={{ fontSize: 9 }}>{data.auditor.full_name ?? '_______________'}</Text>
              <View style={{ borderBottom: '1pt solid #333', marginTop: 20, paddingBottom: 2 }}>
                <Text style={{ fontSize: 8, color: '#aaa', textAlign: 'right' }}>(서명 또는 인)</Text>
              </View>
            </View>
            <View style={{ width: 200 }}>
              <Text style={{ fontSize: 8, color: '#666', marginBottom: 4 }}>입주자대표회의 의장</Text>
              <Text style={{ fontSize: 9 }}>_______________</Text>
              <View style={{ borderBottom: '1pt solid #333', marginTop: 20, paddingBottom: 2 }}>
                <Text style={{ fontSize: 8, color: '#aaa', textAlign: 'right' }}>(서명 또는 인)</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
