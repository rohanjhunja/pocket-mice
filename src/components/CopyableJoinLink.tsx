'use client'

import { Link as LinkIcon, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface CopyableJoinLinkProps {
  sessionCode: string
}

export function CopyableJoinLink({ sessionCode }: CopyableJoinLinkProps) {
  const [copied, setCopied] = useState(false)
  const relativeLink = `/join/${sessionCode}`

  const handleCopy = async () => {
    try {
      // In a real env, this would be the actual production domain
      const fullUrl = `${window.location.origin}${relativeLink}`
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      toast.error('Failed to copy link')
    }
  }

  return (
    <button 
      onClick={handleCopy}
      className="bg-white px-6 py-4 rounded-xl border-2 border-slate-200 shadow-sm flex items-center gap-4 hover:border-blue-400 hover:bg-slate-50 transition-colors text-left group"
      aria-label="Copy student join link"
    >
      <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-blue-100 transition-colors">
        <LinkIcon className="text-slate-600 w-6 h-6 group-hover:text-blue-600 transition-colors" />
      </div>
      <div className="flex-1">
        <div className="text-xs uppercase font-bold text-slate-500 tracking-wider">Student Join Link</div>
        <div className="font-mono text-lg font-bold text-blue-600">{relativeLink}</div>
      </div>
      <div className="text-slate-400 group-hover:text-blue-600 transition-colors ml-4">
        {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
      </div>
    </button>
  )
}
