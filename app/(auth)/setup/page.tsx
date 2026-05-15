'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2 } from 'lucide-react'
import { createApartmentComplex } from '@/lib/actions/apartment'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const schema = z.object({
  name: z.string().min(2, '아파트 단지명은 2자 이상이어야 합니다'),
  address: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function SetupPage() {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = (data: FormValues) => {
    setError(null)
    startTransition(async () => {
      const result = await createApartmentComplex(data.name, data.address)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <Card>
      <CardHeader className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">아파트 단지 설정</CardTitle>
        <CardDescription>감사할 아파트 단지 정보를 입력해주세요</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">아파트 단지명 *</label>
            <Input
              id="name"
              placeholder="예: 래미안 한강아파트"
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="address" className="text-sm font-medium">주소 (선택)</label>
            <Input
              id="address"
              placeholder="예: 서울시 강남구 ..."
              {...register('address')}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '설정 중...' : '완료'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
