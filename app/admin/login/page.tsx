import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { LoginForm } from '@/components/admin/login-form'

export default async function LoginPage() {
  const hasAdmin = (await prisma.adminUser.count()) > 0
  if (!hasAdmin) {
    redirect('/admin/setup')
  }

  return <LoginForm />
}
