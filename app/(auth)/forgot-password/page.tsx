'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { requestPasswordReset } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요'),
})

type FormValues = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, formState: { errors }, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = (data: FormValues) => {
    setServerError(null)
    startTransition(async () => {
      const result = await requestPasswordReset(data.email)
      if (result?.error) setServerError(result.error)
      else setSent(true)
    })
  }

  return (
    <Card>
      <CardHeader className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">비밀번호 찾기</CardTitle>
        <CardDescription>가입한 이메일로 재설정 링크를 보내드립니다</CardDescription>
      </CardHeader>

      <CardContent>
        {sent ? (
          <div className="text-center space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{getValues('email')}</span>으로
            </p>
            <p className="text-sm text-muted-foreground">
              비밀번호 재설정 링크를 발송했습니다.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              이메일이 오지 않으면 스팸함을 확인해주세요.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">이메일</label>
              <Input
                id="email"
                type="email"
                placeholder="auditor@example.com"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? '발송 중...' : '재설정 링크 보내기'}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          로그인으로 돌아가기
        </Link>
      </CardFooter>
    </Card>
  )
}
