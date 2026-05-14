export default function TestReceiptRender() {
  return (
    <div style={{ background: '#fff', display: 'flex', justifyContent: 'center', padding: 20, fontFamily: "'Courier New', monospace" }}>
      <div style={{ width: 320, border: '1px solid #ccc', padding: 20, fontSize: 13, lineHeight: 1.8 }}>
        <div style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 }}>영 수 증</div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#555' }}>사업자등록번호: 123-45-67890</div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#555' }}>서울특별시 강남구 테헤란로 123</div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#555' }}>대표: 홍길동 | TEL: 02-1234-5678</div>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>거래일시</span><span>2026-05-14 14:32:10</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>가맹점명</span><span>사무용품마트</span></div>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>품목</span><span>수량</span><span>금액</span></div>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>A4용지(500매)</span><span>2</span><span>24,000</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>볼펜세트</span><span>3</span><span>9,000</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>스테이플러</span><span>1</span><span>8,000</span></div>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>공급가액</span><span>37,273</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>부가세(10%)</span><span>3,727</span></div>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 15 }}><span>합계금액</span><span>41,000원</span></div>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>결제수단</span><span>신용카드</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>카드사</span><span>신한카드</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>카드번호</span><span>****-****-****-1234</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>승인번호</span><span>12345678</span></div>
        <hr style={{ border: 'none', borderTop: '1px dashed #999', margin: '8px 0' }} />
        <div style={{ textAlign: 'center', fontSize: 11, color: '#555' }}>감사합니다. 영수증을 보관하세요.</div>
      </div>
    </div>
  )
}
