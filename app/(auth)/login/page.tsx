'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Image from 'next/image'
import Link from 'next/link'
import { ShieldCheck, FlaskConical } from 'lucide-react'
import { login } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'

const DEMO_EMAIL = 'demo@aas-test.com'
const DEMO_PASSWORD = 'Demo1234!'

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const fillDemo = () => {
    setValue('email', DEMO_EMAIL)
    setValue('password', DEMO_PASSWORD)
  }

  const onSubmit = (data: FormValues) => {
    setServerError(null)
    startTransition(async () => {
      const result = await login(data.email, data.password)
      if (result?.error) setServerError(result.error)
    })
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center">

      {/* 원본 배경 이미지 — 선명하게 */}
      <Image
        src="/images/login-bg.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center"
      />

      {/* 가벼운 전체 어둠 (폼 가독성용) */}
      <div className="absolute inset-0 bg-black/30" />

      {/* 중앙 로그인 카드 */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">

          {/* 헤더 */}
          <div className="px-8 pt-9 pb-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-2xl bg-white/20">
                <ShieldCheck className="h-7 w-7 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">감사 시스템</h1>
            <p className="text-white/70 text-sm mt-1">입주자대표회의 감사 플랫폼</p>
          </div>

          {/* 데모 버튼 */}
          <div className="px-8 pb-2">
            <button
              type="button"
              onClick={fillDemo}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white/90 text-sm font-medium py-2.5 transition-colors"
            >
              <FlaskConical className="h-4 w-4 text-yellow-300" />
              데모 계정으로 체험하기
            </button>
            <p className="text-center text-xs text-white/40 mt-1.5">
              demo@aas-test.com · Demo1234!
            </p>
          </div>

          {/* 구분선 */}
          <div className="px-8 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/15" />
            <span className="text-xs text-white/30">또는</span>
            <div className="flex-1 h-px bg-white/15" />
          </div>

          {/* 폼 */}
          <div className="px-8 pb-6 space-y-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-white/90">이메일</label>
              <Input
                id="email"
                type="email"
                placeholder="auditor@example.com"
                autoComplete="email"
                className="bg-white/15 border-white/25 text-white placeholder:text-white/40 focus:border-white/60 focus:bg-white/20"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-300">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-white/90">비밀번호</label>
                <Link href="/forgot-password" className="text-xs text-white/50 hover:text-white/80 transition-colors">
                  비밀번호 찾기
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="bg-white/15 border-white/25 text-white placeholder:text-white/40 focus:border-white/60 focus:bg-white/20"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-red-300">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold h-10 mt-1"
              disabled={isPending}
              onClick={handleSubmit(onSubmit)}
            >
              {isPending ? '로그인 중...' : '로그인'}
            </Button>
          </div>

          {/* 푸터 */}
          <div className="px-8 py-4 border-t border-white/10 text-center">
            <p className="text-sm text-white/50">
              계정이 없으신가요?{' '}
              <Link href="/signup" className="text-blue-300 font-medium hover:text-blue-200">
                회원가입
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
