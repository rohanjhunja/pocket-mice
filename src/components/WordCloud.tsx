'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'

// d3-cloud word shape — mirrors the Word interface exported by react-d3-cloud internally
interface Word {
  text?: string
  value: number
  size?: number
  font?: string
  rotate?: number
  x?: number
  y?: number
}

// react-d3-cloud uses browser canvas for layout — must be client-only
const D3WordCloud = dynamic(() => import('react-d3-cloud'), { ssr: false })

// ---------------------------------------------------------------------------
// Stop-word list (English, minimal)
// ---------------------------------------------------------------------------
const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'as','by','from','is','it','its','was','are','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','shall','can','not','no','nor','so','yet','both','either',
  'each','few','more','most','other','some','such','than','then','too',
  'very','just','into','over','also','there','here','when','where',
  'which','who','what','how','that','this','these','those','i','you','he',
  'she','we','they','me','him','her','us','them','my','your','his','our',
  'their','its','all','any','about','up','out','if','because','while',
])

// ---------------------------------------------------------------------------
// Lightweight English lemmatizer (suffix rules)
// ---------------------------------------------------------------------------
function lemmatize(word: string): string {
  if (word.length <= 3) return word
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y'
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 4) return word.slice(0, -1)
  if (word.endsWith('ing') && word.length > 5) {
    const stem = word.slice(0, -3)
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) return stem.slice(0, -1)
    return stem
  }
  if (word.endsWith('ed') && word.length > 4) {
    const stem = word.slice(0, -2)
    if (stem.length >= 2 && stem[stem.length - 1] === stem[stem.length - 2]) return stem.slice(0, -1)
    return stem
  }
  if (word.endsWith('er') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('est') && word.length > 5) return word.slice(0, -3)
  return word
}

// ---------------------------------------------------------------------------
// Text → word frequency map
// ---------------------------------------------------------------------------
export function buildWordFrequencies(texts: string[]): Map<string, number> {
  const freq = new Map<string, number>()
  for (const text of texts) {
    const clean = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/-+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    for (const raw of clean.split(' ')) {
      if (!raw || raw.length < 2) continue
      const word = lemmatize(raw)
      if (STOP_WORDS.has(word)) continue
      freq.set(word, (freq.get(word) ?? 0) + 1)
    }
  }
  return freq
}

// ---------------------------------------------------------------------------
// Colour palette — consistent with app blue/indigo scheme
// ---------------------------------------------------------------------------
const PALETTE = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#0ea5e9',
  '#14b8a6', '#f59e0b', '#ec4899', '#10b981',
]

interface WordCloudProps {
  texts: string[]
  activeWord?: string | null
  onWordClick: (word: string) => void
  maxWords?: number
}

export function WordCloud({ texts, activeWord, onWordClick, maxWords = 60 }: WordCloudProps) {
  const words = useMemo(() => {
    const freq = buildWordFrequencies(texts)
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxWords)
      .map(([text, value]) => ({ text, value }))
  }, [texts, maxWords])

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        No responses yet
      </div>
    )
  }

  const maxFreq = words[0]?.value ?? 1

  return (
    <div
      className="w-full relative"
      style={{ height: 200 }}
      role="img"
      aria-label="Word cloud of response frequency"
    >
      <D3WordCloud
        data={words}
        width={480}
        height={200}
        font="Inter, system-ui, sans-serif"
        fontWeight={(w: Word) => (w.text === activeWord ? 700 : 500)}
        fontSize={(w: Word) => Math.round(13 + (w.value / maxFreq) * 29)}
        rotate={0}
        padding={4}
        fill={((_, w: Word) => {
          if (w.text === activeWord) return '#1d4ed8'
          const idx = (w.text?.charCodeAt(0) ?? 0) % PALETTE.length
          return PALETTE[idx]
        }) as (this: SVGTextElement, event: SVGTextElement, d: Word) => string}
        onWordClick={(_e: unknown, d: Word) => onWordClick(d.text ?? '')}
      />
    </div>
  )
}
