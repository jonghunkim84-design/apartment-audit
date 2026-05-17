'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShieldCheck } from 'lucide-react'
import { updatePassword } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const schema = z.object({
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirm'],
})

type FormValues = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = (data: FormValues) => {
    setServerError(null)
    startTransition(async () => {
      const result = await updatePassword(data.password)
      if (result?.error) setServerError(result.error)
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
    <div className="w-full max-w-md px-4">
    <Card>
      <CardHeader className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">새 비밀번호 설정</CardTitle>
        <CardDescription>새로운 비밀번호를 입력해주세요</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">새 비밀번호</label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="6자 이상"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium">비밀번호 확인</label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              {...register('confirm')}
            />
            {errors.confirm && (
              <p className="text-xs text-destructive">{errors.confirm.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </form>
      </CardContent>
    </Card>
    </div>
    </div>
  )
}
