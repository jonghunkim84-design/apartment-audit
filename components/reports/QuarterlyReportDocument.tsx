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
import type { QuarterlyReportData } from '@/lib/actions/quarterly-report-data'

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
  formLabel: {
    fontSize: 8,
    color: '#666',
    textAlign: 'right',
    marginBottom: 12,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 24,
    marginTop: 8,
  },
  metaTable: {
    border: '1pt solid #333',
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #ccc',
  },
  metaRowLast: {
    flexDirection: 'row',
  },
  metaLabel: {
    width: 90,
    backgroundColor: '#f0f3f7',
    fontWeight: 700,
    fontSize: 9,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRight: '1pt solid #ccc',
  },
  metaValue: {
    flex: 1,
    fontSize: 9,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  sectionHeader: {
    backgroundColor: '#1e3a5f',
    color: '#fff',
    fontWeight: 700,
    fontSize: 10,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 16,
  },
  table: {
    borderTop: '1pt solid #999',
    borderLeft: '1pt solid #999',
    marginBottom: 12,
  },
  tableHead: {
    flexDirection: 'row',
    borderBottom: '1.5pt solid #333',
    backgroundColor: '#f0f3f7',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #ccc',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '1pt solid #ccc',
    backgroundColor: '#f9fafb',
  },
  th: {
    borderRight: '1pt solid #999',
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'center',
  },
  td: {
    borderRight: '1pt solid #999',
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 8,
  },
  noData: {
    color: '#aaa',
    fontSize: 8,
    textAlign: 'center',
    paddingVertical: 12,
    borderRight: '1pt solid #999',
    borderBottom: '1pt solid #999',
    flex: 1,
  },
  severityBadge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  signatureSect: {
    marginTop: 24,
    borderTop: '1pt solid #ccc',
    paddingTop: 16,
  },
  signatureTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 12,
    textAlign: 'center',
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  signatureBox: {
    width: 160,
    borderBottom: '1pt solid #333',
    paddingTop: 30,
    paddingBottom: 4,
    alignItems: 'center',
  },
  signatureLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 4,
  },
  footerNote: {
    fontSize: 7,
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
})

function fmtDate(s: string | null): string {
  if (!s) return '-'
  return s.slice(0, 10)
}

function severityKr(sev: string): string {
  const map: Record<string, string> = {
    CRITICAL: '중요',
    WARNING: '경고',
    INFO: '정보',
    HIGH: '중요',
    MEDIUM: '보통',
    LOW: '낮음',
  }
  return map[sev] ?? sev
}

function statusKr(st: string): string {
  const map: Record<string, string> = {
    open: '미처리',
    in_progress: '처리중',
    resolved: '처리완료',
    draft: '작성중',
    closed: '종결',
  }
  return map[st] ?? st
}

interface Props {
  data: QuarterlyReportData
}

export function QuarterlyReportDocument({ data }: Props) {
  const { apartment, auditor, period, quarter, year, target, supervisee, reportTitle, findings } = data

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* 서식 번호 */}
        <Text style={s.formLabel}>별지 제3-1호서식</Text>

        {/* 제목 */}
        <Text style={s.mainTitle}>{year}년 제{quarter}분기 감사결과 보고서</Text>

        {/* 기본 정보 메타 테이블 */}
        <View style={s.metaTable}>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>아파트 단지</Text>
            <Text style={s.metaValue}>{apartment.name}</Text>
            <Text style={s.metaLabel}>감사 기간</Text>
            <Text style={s.metaValue}>{fmtDate(period.from)} ~ {fmtDate(period.to)}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>감사 대상</Text>
            <Text style={s.metaValue}>{target || '—'}</Text>
            <Text style={s.metaLabel}>피감사인</Text>
            <Text style={s.metaValue}>{supervisee || '—'}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>보고서 제목</Text>
            <Text style={[s.metaValue, { flex: 3 }]}>{reportTitle}</Text>
          </View>
          <View style={s.metaRowLast}>
            <Text style={s.metaLabel}>감사인</Text>
            <Text style={s.metaValue}>{auditor.full_name || '—'}</Text>
            <Text style={s.metaLabel}>작성일</Text>
            <Text style={s.metaValue}>{fmtDate(data.generatedAt)}</Text>
          </View>
        </View>

        {/* 감사 지적사항 */}
        <Text style={s.sectionHeader}>감사 지적사항 목록</Text>

        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={[s.th, { width: 28 }]}>번호</Text>
            <Text style={[s.th, { flex: 2 }]}>지적사항 제목</Text>
            <Text style={[s.th, { flex: 3 }]}>내용</Text>
            <Text style={[s.th, { width: 40 }]}>심각도</Text>
            <Text style={[s.th, { width: 40 }]}>상태</Text>
            <Text style={[s.th, { flex: 2 }]}>조치 계획 / 결과</Text>
            <Text style={[s.th, { width: 54 }]}>조치 기한</Text>
          </View>

          {findings.length === 0 ? (
            <View style={{ flexDirection: 'row', borderBottom: '1pt solid #999' }}>
              <Text style={s.noData}>해당 기간 지적사항이 없습니다.</Text>
            </View>
          ) : (
            findings.map((f, i) => (
              <View key={f.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
                <Text style={[s.td, { width: 28, textAlign: 'center' }]}>{i + 1}</Text>
                <Text style={[s.td, { flex: 2 }]}>{f.title}</Text>
                <Text style={[s.td, { flex: 3 }]}>{f.description ?? '—'}</Text>
                <Text style={[s.td, { width: 40, textAlign: 'center' }]}>{severityKr(f.severity)}</Text>
                <Text style={[s.td, { width: 40, textAlign: 'center' }]}>{statusKr(f.status)}</Text>
                <Text style={[s.td, { flex: 2 }]}>{f.remediation_note ?? '—'}</Text>
                <Text style={[s.td, { width: 54, textAlign: 'center' }]}>{fmtDate(f.remediation_due)}</Text>
              </View>
            ))
          )}
        </View>

        {/* 요약 */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 1, border: '1pt solid #ddd', borderRadius: 3, padding: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#666', marginBottom: 3 }}>총 지적사항</Text>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>{findings.length}건</Text>
          </View>
          <View style={{ flex: 1, border: '1pt solid #ddd', borderRadius: 3, padding: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#666', marginBottom: 3 }}>처리 완료</Text>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>
              {findings.filter(f => f.status === 'resolved' || f.status === 'closed').length}건
            </Text>
          </View>
          <View style={{ flex: 1, border: '1pt solid #ddd', borderRadius: 3, padding: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#666', marginBottom: 3 }}>미처리</Text>
            <Text style={{ fontSize: 14, fontWeight: 700, color: '#c0392b' }}>
              {findings.filter(f => f.status === 'open' || f.status === 'draft').length}건
            </Text>
          </View>
          <View style={{ flex: 1, border: '1pt solid #ddd', borderRadius: 3, padding: 8, alignItems: 'center' }}>
            <Text style={{ fontSize: 8, color: '#666', marginBottom: 3 }}>중요(CRITICAL)</Text>
            <Text style={{ fontSize: 14, fontWeight: 700, color: '#c0392b' }}>
              {findings.filter(f => f.severity === 'CRITICAL' || f.severity === 'HIGH').length}건
            </Text>
          </View>
        </View>

        {/* 서명란 */}
        <View style={s.signatureSect}>
          <Text style={s.signatureTitle}>확인 서명</Text>
          <View style={s.signatureRow}>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>감사인</Text>
              <Text style={{ fontSize: 8, color: '#999' }}>(서명 또는 날인)</Text>
            </View>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>관리소장</Text>
              <Text style={{ fontSize: 8, color: '#999' }}>(서명 또는 날인)</Text>
            </View>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>입주자대표회의 의장</Text>
              <Text style={{ fontSize: 8, color: '#999' }}>(서명 또는 날인)</Text>
            </View>
          </View>
        </View>

        <Text style={s.footerNote}>
          공동주택관리법 제26조 및 감사 업무규정 제5조 · 제6조에 따라 작성된 분기 감사결과 보고서입니다.
        </Text>
      </Page>
    </Document>
  )
}
