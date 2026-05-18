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
    paddingHorizontal: 40,
    color: '#1a1a1a',
  },
  formLabel: {
    fontSize: 8,
    color: '#666',
    textAlign: 'right',
    marginBottom: 10,
  },
  mainTitle: {
    fontSize: 15,
    fontWeight: 700,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 4,
  },
  subTitle: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'center',
  },
  metaLabel: {
    width: 60,
    fontWeight: 700,
    fontSize: 9,
  },
  metaValue: {
    flex: 1,
    fontSize: 9,
    borderBottom: '0.5pt solid #999',
    paddingBottom: 2,
    minHeight: 14,
  },
  metaBlank: {
    flex: 1,
    fontSize: 9,
    borderBottom: '0.5pt solid #999',
    paddingBottom: 2,
    minHeight: 14,
    color: '#aaa',
  },
  table: {
    borderTop: '1.5pt solid #333',
    borderLeft: '1.5pt solid #333',
    marginTop: 14,
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
    minHeight: 20,
  },
  tableRowTotal: {
    flexDirection: 'row',
    borderBottom: '1.5pt solid #333',
    borderTop: '1.5pt solid #333',
    backgroundColor: '#f0f3f7',
    minHeight: 22,
  },
  th: {
    borderRight: '1pt solid #999',
    paddingVertical: 5,
    paddingHorizontal: 3,
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'center',
  },
  td: {
    borderRight: '1pt solid #ccc',
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: 8,
  },
  tdTotal: {
    borderRight: '1pt solid #999',
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 8,
    fontWeight: 700,
  },
  verifyBox: {
    border: '1pt solid #333',
    padding: 12,
    marginBottom: 20,
    marginTop: 4,
  },
  verifyText: {
    fontSize: 9,
    lineHeight: 1.6,
  },
  signatureSect: {
    marginTop: 20,
    borderTop: '1pt solid #ccc',
    paddingTop: 14,
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
    width: 180,
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
    marginTop: 16,
  },
})

export interface BalanceReportData {
  year: number
  month: number
  apartmentName: string
  auditorName: string
  generatedAt: string
}

const BLANK_ROWS = 10

const MONTH_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

interface Props {
  data: BalanceReportData
}

export function BalanceReportDocument({ data }: Props) {
  const { year, month, apartmentName, auditorName, generatedAt } = data
  const monthStr = MONTH_KR[month - 1] ?? `${month}월`

  return (
    <Document>
      <Page size="A4" style={s.page} orientation="landscape">
        {/* 서식 번호 */}
        <Text style={s.formLabel}>별지 제3-2호서식</Text>

        {/* 제목 */}
        <Text style={s.mainTitle}>예금잔액 ↔ 관계장부 대조 확인 보고서</Text>
        <Text style={s.subTitle}>{year}년 {monthStr}</Text>

        {/* 기본 정보 */}
        <View style={{ flexDirection: 'row', gap: 20, marginBottom: 4 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.metaLabel}>단지명</Text>
            <Text style={[s.metaValue]}>{apartmentName}</Text>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.metaLabel}>기준일</Text>
            <Text style={s.metaBlank}>{year}년 {month}월 말일</Text>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.metaLabel}>작성일</Text>
            <Text style={s.metaValue}>{generatedAt.slice(0, 10)}</Text>
          </View>
        </View>

        {/* 대조 표 */}
        <View style={s.table}>
          {/* 헤더 */}
          <View style={s.tableHead}>
            <Text style={[s.th, { width: 30 }]}>번호</Text>
            <Text style={[s.th, { width: 70 }]}>금융기관</Text>
            <Text style={[s.th, { width: 70 }]}>용도</Text>
            <Text style={[s.th, { width: 50 }]}>종류</Text>
            <Text style={[s.th, { flex: 2 }]}>계좌번호</Text>
            <Text style={[s.th, { flex: 1.5 }]}>장부금액 (원)</Text>
            <Text style={[s.th, { flex: 1.5 }]}>확인금액 (원)</Text>
            <Text style={[s.th, { flex: 1.5 }]}>차이금액 (원)</Text>
            <Text style={[s.th, { flex: 2 }]}>비고</Text>
          </View>

          {/* 빈 데이터 행 */}
          {Array.from({ length: BLANK_ROWS }).map((_, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.td, { width: 30, textAlign: 'center' }]}>{i + 1}</Text>
              <Text style={[s.td, { width: 70 }]}> </Text>
              <Text style={[s.td, { width: 70 }]}> </Text>
              <Text style={[s.td, { width: 50 }]}> </Text>
              <Text style={[s.td, { flex: 2 }]}> </Text>
              <Text style={[s.td, { flex: 1.5, textAlign: 'right' }]}> </Text>
              <Text style={[s.td, { flex: 1.5, textAlign: 'right' }]}> </Text>
              <Text style={[s.td, { flex: 1.5, textAlign: 'right' }]}> </Text>
              <Text style={[s.td, { flex: 2 }]}> </Text>
            </View>
          ))}

          {/* 합계 행 */}
          <View style={s.tableRowTotal}>
            <Text style={[s.tdTotal, { width: 30, textAlign: 'center' }]}> </Text>
            <Text style={[s.tdTotal, { width: 70 }]}> </Text>
            <Text style={[s.tdTotal, { width: 70 }]}> </Text>
            <Text style={[s.tdTotal, { width: 50, textAlign: 'center' }]}>합계</Text>
            <Text style={[s.tdTotal, { flex: 2 }]}> </Text>
            <Text style={[s.tdTotal, { flex: 1.5, textAlign: 'right' }]}> </Text>
            <Text style={[s.tdTotal, { flex: 1.5, textAlign: 'right' }]}> </Text>
            <Text style={[s.tdTotal, { flex: 1.5, textAlign: 'right' }]}> </Text>
            <Text style={[s.tdTotal, { flex: 2 }]}> </Text>
          </View>
        </View>

        {/* 대조 확인 문구 */}
        <View style={s.verifyBox}>
          <Text style={s.verifyText}>
            위와 같이 {year}년 {monthStr} 말 현재 예금잔액을 금융기관 잔액증명서와 관리비 관계장부를 대조 확인하였으며,
            장부금액과 확인금액이 일치(또는 상이)함을 확인합니다.
          </Text>
          <Text style={[s.verifyText, { marginTop: 6, color: '#555' }]}>
            ※ 「공동주택관리법」 제26조 및 동법 시행규칙 별지 제3-2호서식에 따라 작성하였습니다.
          </Text>
        </View>

        {/* 서명란 */}
        <View style={s.signatureSect}>
          <Text style={s.signatureTitle}>확인 서명</Text>
          <View style={s.signatureRow}>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>감사인 : {auditorName || '              '}</Text>
              <Text style={{ fontSize: 8, color: '#999' }}>(서명 또는 날인)</Text>
            </View>
            <View style={s.signatureBox}>
              <Text style={s.signatureLabel}>관리소장</Text>
              <Text style={{ fontSize: 8, color: '#999' }}>(서명 또는 날인)</Text>
            </View>
          </View>
        </View>

        <Text style={s.footerNote}>
          공동주택관리법 시행규칙 별지 제3-2호서식 — 매월 말일 예금잔액 ↔ 관계장부 대조 확인용
        </Text>
      </Page>
    </Document>
  )
}
