import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { XIcon } from 'lucide-react'
import { PLATFORM_OPTIONS, PLATFORM_TWITTER } from '../utils/codeConstants'

const MAX_SNS_LINKS = 4

interface SnsLinkInput {
  id: string
  platform: number
  url: string
}

interface SnsLinkEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLinks: Array<{ platform?: number; url: string }>
  onSave: (links: Array<{ platform: number; url: string }>) => void
}

let snsLinkIdCounter = 0
function generateId(): string {
  snsLinkIdCounter += 1
  return `sns-edit-${snsLinkIdCounter}`
}

export function SnsLinkEditDialog({ open, onOpenChange, initialLinks, onSave }: Readonly<SnsLinkEditDialogProps>) {
  const [links, setLinks] = useState<SnsLinkInput[]>(() =>
    initialLinks.length > 0
      ? initialLinks.map(l => ({ id: generateId(), platform: l.platform || PLATFORM_TWITTER, url: l.url }))
      : [{ id: generateId(), platform: PLATFORM_TWITTER, url: '' }]
  )

  // ダイアログが開かれたときにinitialLinksで状態をリセット
  useEffect(() => {
    if (open) {
      setLinks(
        initialLinks.length > 0
          ? initialLinks.map(l => ({ id: generateId(), platform: l.platform || PLATFORM_TWITTER, url: l.url }))
          : [{ id: generateId(), platform: PLATFORM_TWITTER, url: '' }]
      )
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = () => {
    if (links.length < MAX_SNS_LINKS) {
      setLinks([...links, { id: generateId(), platform: PLATFORM_TWITTER, url: '' }])
    }
  }

  const handleRemove = (index: number) => {
    setLinks(links.filter((_, i) => i !== index))
  }

  const handleUpdate = (index: number, field: 'platform' | 'url', value: string | number) => {
    const updated = [...links]
    updated[index] = { ...updated[index], [field]: value }
    setLinks(updated)
  }

  const handleSave = () => {
    const filledLinks = links.filter(l => l.url.trim() !== '').map(l => ({ platform: l.platform, url: l.url }))
    onSave(filledLinks)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="sns-link-edit-dialog" className="max-h-[90vh]" style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', maxHeight: '90dvh' }} onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Fixed header */}
        <div className="px-6 pt-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle>SNSリンクを編集</DialogTitle>
            <DialogDescription className="sr-only">SNSリンクの追加・編集・削除</DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
        <div className="space-y-4 mt-4">
          {links.map((link, index) => (
            <div key={link.id} className="flex gap-2 items-center">
              <select
                data-testid={`sns-platform-select-${index}`}
                className="w-32 border rounded-md px-3 py-2"
                value={link.platform}
                onChange={(e) => handleUpdate(index, 'platform', Number(e.target.value))}
              >
                {PLATFORM_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <Input
                data-testid={`sns-url-input-${index}`}
                placeholder="https://..."
                className="flex-1"
                value={link.url}
                onChange={(e) => handleUpdate(index, 'url', e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                data-testid={`delete-sns-link-${index}`}
                onClick={() => handleRemove(index)}
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {links.length < MAX_SNS_LINKS && (
            <Button
              variant="outline"
              size="sm"
              data-testid="add-sns-link-button"
              onClick={handleAdd}
              className="w-full"
            >
              リンクを追加
            </Button>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave}>
            保存
          </Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
