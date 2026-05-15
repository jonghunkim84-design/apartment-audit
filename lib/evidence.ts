import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'

// ── SHA-256 해시 생성 ─────────────────────────────────────────────────────────

export function computeHash(buffer: Buffer | ArrayBuffer): string {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(new Uint8Array(buffer as ArrayBuffer))
  return crypto.createHash('sha256').update(buf).digest('hex')
}

// ── 파일 무결성 검증 ──────────────────────────────────────────────────────────
// storedHash: 최초 업로드 시 저장된 SHA-256
// currentBuffer: 현재 파일 내용
// 불일치 시 [파일변조의심] 경고 반환

export interface IntegrityResult {
  intact: boolean
  currentHash: string
  storedHash: string
  warning: string | null
}

export function verifyIntegrity(
  currentBuffer: Buffer | ArrayBuffer,
  storedHash: string
): IntegrityResult {
  const currentHash = computeHash(currentBuffer)
  const intact = currentHash === storedHash
  return {
    intact,
    currentHash,
    storedHash,
    warning: intact ? null : '[파일변조의심] 저장된 해시값과 현재 파일이 일치하지 않습니다.',
  }
}

// ── 열람 이력 기록 ────────────────────────────────────────────────────────────
// action: VIEW | DOWNLOAD | APPROVE | REJECT
// 모든 이력은 audit_logs 테이블에 저장됨

export type AuditAction = 'VIEW' | 'DOWNLOAD' | 'APPROVE' | 'REJECT'

export interface LogAuditOptions {
  receiptId?: string
  ipAddress?: string
  metadata?: Record<string, unknown>
}

export async function logAuditEvent(
  action: AuditAction,
  fileId: string,
  options: LogAuditOptions = {}
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('audit_logs').insert({
    user_id:    user.id,
    action,
    file_id:    fileId,
    receipt_id: options.receiptId  ?? null,
    ip_address: options.ipAddress  ?? null,
    metadata:   (options.metadata ?? null) as import('@/types/database').Json | null,
  })
}

// ── 업로드 + 해시 생성 헬퍼 ──────────────────────────────────────────────────
// OCR route 등에서 파일 업로드 시 호출
// 반환값의 hash를 receipts.ai_parsed_data 또는 별도 컬럼에 저장할 것

export interface UploadWithHashResult {
  storagePath: string
  signedUrl: string | null
  hash: string
}

export async function uploadFileWithHash(
  file: File,
  buffer: Buffer,
  apartmentComplexId: string,
  userId: string
): Promise<UploadWithHashResult> {
  const supabase = await createClient()
  const hash = computeHash(buffer)
  const storagePath = `${apartmentComplexId}/${userId}/${Date.now()}_${file.name}`

  const { data: storageData } = await supabase.storage
    .from('receipts')
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  let signedUrl: string | null = null
  if (storageData) {
    const { data: signed } = await supabase.storage
      .from('receipts')
      .createSignedUrl(storageData.path, 60 * 60 * 24 * 365)
    signedUrl = signed?.signedUrl ?? null
  }

  return { storagePath, signedUrl, hash }
}

// ── 파일 열람 시 무결성 검증 + 이력 기록 (통합 함수) ────────────────────────

export async function openFileWithAudit(
  fileId: string,
  currentBuffer: Buffer,
  storedHash: string,
  action: AuditAction = 'VIEW',
  options: LogAuditOptions = {}
): Promise<IntegrityResult> {
  const result = verifyIntegrity(currentBuffer, storedHash)

  await logAuditEvent(action, fileId, {
    ...options,
    metadata: {
      ...options.metadata,
      intact: result.intact,
      currentHash: result.currentHash,
      ...(result.warning && { warning: result.warning }),
    },
  })

  return result
}
