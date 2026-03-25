'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface SiteConfig {
  userName: string
  userBio: string
  avatarUrl: string
  userNote: string
  historyWindowMinutes: number
  currentlyText: string
  earlierText: string
  updatesText: string
  adminText: string
}

export function WebSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [form, setForm] = useState<SiteConfig>({
    userName: '',
    userBio: '',
    avatarUrl: '',
    userNote: '',
    historyWindowMinutes: 120,
    currentlyText: 'currently',
    earlierText: 'earlier',
    updatesText: 'updates every 30 seconds',
    adminText: 'admin',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/settings')
        const data = await res.json()
        if (data?.success && data?.data) {
          setForm({
            userName: data.data.userName ?? '',
            userBio: data.data.userBio ?? '',
            avatarUrl: data.data.avatarUrl ?? '',
            userNote: data.data.userNote ?? '',
            historyWindowMinutes: Number(data.data.historyWindowMinutes ?? 120),
            currentlyText: data.data.currentlyText ?? 'currently',
            earlierText: data.data.earlierText ?? 'earlier',
            updatesText: data.data.updatesText ?? 'updates every 30 seconds',
            adminText: data.data.adminText ?? 'admin',
          })
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const patch = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onFileSelected = async (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (result) patch('avatarUrl', result)
    }
    reader.readAsDataURL(file)
  }

  const save = async () => {
    setMessage('')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setMessage(data?.error || '保存失败')
        return
      }
      setMessage('保存成功，主页刷新后生效')
    } catch {
      setMessage('网络异常，请重试')
    } finally {
      setSaving(false)
    }
  }

  const copyExportConfig = async () => {
    setMessage('')
    try {
      const res = await fetch('/api/admin/settings/export')
      const data = await res.json()
      if (!res.ok || !data?.success || !data?.data?.encoded) {
        setMessage(data?.error || '导出失败')
        return
      }

      await navigator.clipboard.writeText(data.data.encoded)
      setMessage('已复制 Base64 接入配置，可在其他设备解码后使用')
    } catch {
      setMessage('复制失败，请重试')
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">加载配置中...</div>
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      <h3 className="font-semibold text-foreground">Web 配置</h3>

      <div className="space-y-2">
        <Label>首页名称</Label>
        <Input value={form.userName} onChange={(e) => patch('userName', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>首页简介</Label>
        <Input value={form.userBio} onChange={(e) => patch('userBio', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>首页备注</Label>
        <Input value={form.userNote} onChange={(e) => patch('userNote', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>头像地址（URL / DataURL）</Label>
        <Input value={form.avatarUrl} onChange={(e) => patch('avatarUrl', e.target.value)} />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => void onFileSelected(e.target.files?.[0])}
          className="w-full text-xs text-muted-foreground"
        />
      </div>

      <div className="space-y-2">
        <Label>历史窗口（分钟）</Label>
        <Input
          type="number"
          min={10}
          max={1440}
          value={form.historyWindowMinutes}
          onChange={(e) => patch('historyWindowMinutes', Number(e.target.value || 120))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>当前区块标题</Label>
          <Input value={form.currentlyText} onChange={(e) => patch('currentlyText', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>历史区块标题</Label>
          <Input value={form.earlierText} onChange={(e) => patch('earlierText', e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>底部更新文案</Label>
          <Input value={form.updatesText} onChange={(e) => patch('updatesText', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>后台入口文案</Label>
          <Input value={form.adminText} onChange={(e) => patch('adminText', e.target.value)} />
        </div>
      </div>

      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? '保存中...' : '保存配置'}
        </Button>
        <Button type="button" variant="outline" onClick={copyExportConfig}>
          一键复制接入配置（Base64）
        </Button>
      </div>
    </div>
  )
}
