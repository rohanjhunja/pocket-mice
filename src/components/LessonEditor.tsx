'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Copy,
  X,
  Pencil,
  Film,
  MessageSquare,
  GripVertical,
  ChevronsUpDown,
  ChevronsDownUp,
} from 'lucide-react'
import { updateLesson, duplicateLesson } from '@/app/dashboard/lesson/[id]/actions'
import { uploadLesson } from '@/app/dashboard/actions'

// ===== TYPES =====
interface LessonEditorProps {
  lessonId?: string
  jsonContent: any
  onClose: () => void
  createMode?: boolean
}

type EditMode = 'default' | 'advanced'

// ===== PRESETS =====
const GRADE_LEVELS = ['Elementary (K-5)', 'Middle School (6-8)', 'High School (9-12)', 'College', 'Professional']
const DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced']
const ACTIVITY_TYPES = ['exploration', 'investigation', 'analysis', 'discussion', 'assessment']
const STEP_TYPES = ['context', 'question', 'media', 'completion', 'instruction']
const MEDIA_TYPES = ['video', 'simulation', 'content', 'image']
const RESPONSE_TYPES = ['text_short', 'text_long', 'multiple_choice', 'dropdown']

// ===== STEP TEMPLATES =====
function makeId() {
  return 'id_' + Math.random().toString(36).substring(2, 10)
}

const BLANK_STEP_TEMPLATE = {
  step_id: '', step_type: '', title: 'New Step',
  instruction_text: '', instruction_format: 'text', completion_condition: 'next_button',
}

// ===== HELPER: deep clone =====
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

// ===== EDITABLE LIST COMPONENT =====
function EditableList({ items, onChange, label }: { items: string[], onChange: (v: string[]) => void, label: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={item}
            onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n) }}
            className="text-sm"
          />
          <Button variant="ghost" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 px-2">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange([...items, ''])} className="text-blue-600 text-xs gap-1">
        <Plus className="w-3 h-3" /> Add {label.replace(/s$/, '')}
      </Button>
    </div>
  )
}

// ===== SECTION ACCORDION =====
function Section({ id, title, expanded, onToggle, badges, actions, children }: {
  id: string, title: string, expanded: boolean, onToggle: () => void, badges?: React.ReactNode, actions?: React.ReactNode, children: React.ReactNode
}) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${expanded ? 'rotate-180' : ''}`} />
          <span className="font-medium text-sm text-slate-800 truncate">{title}</span>
          {badges}
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-4">
          {children}
        </div>
      )}
    </div>
  )
}

// ===== REORDER BUTTONS =====
function ReorderButtons({ onMoveUp, onMoveDown, onDelete, onAdd, onDuplicate, canMoveUp, canMoveDown }: {
  onMoveUp: () => void, onMoveDown: () => void, onDelete: () => void, onAdd: () => void, onDuplicate: () => void, canMoveUp: boolean, canMoveDown: boolean
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="sm" className="p-1 h-7 w-7" onClick={onAdd} title="Add after">
        <Plus className="w-3.5 h-3.5 text-blue-500" />
      </Button>
      <Button variant="ghost" size="sm" className="p-1 h-7 w-7" onClick={onDuplicate} title="Duplicate">
        <Copy className="w-3.5 h-3.5 text-slate-500" />
      </Button>
      <Button variant="ghost" size="sm" className="p-1 h-7 w-7" onClick={onMoveUp} disabled={!canMoveUp} title="Move up">
        <ArrowUp className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="p-1 h-7 w-7" onClick={onMoveDown} disabled={!canMoveDown} title="Move down">
        <ArrowDown className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="p-1 h-7 w-7 text-slate-400 hover:text-red-500" onClick={onDelete} title="Delete">
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

// AddStepMenu removed — now a simple button

// ===== MAIN COMPONENT =====
export function LessonEditor({ lessonId, jsonContent, onClose, createMode = false }: LessonEditorProps) {
  const router = useRouter()
  const [data, setData] = useState(() => deepClone(jsonContent))
  const [mode, setMode] = useState<EditMode>('default')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const originalRef = useRef(JSON.stringify(jsonContent))

  const markDirty = useCallback(() => setHasChanges(true), [])

  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const collapseAll = useCallback(() => setExpanded(new Set()), [])
  const expandAll = useCallback(() => {
    const keys = new Set<string>()
    keys.add('about')
    data.activities?.forEach((_: any, ai: number) => {
      keys.add(`act-${ai}`)
      _.steps?.forEach((__: any, si: number) => keys.add(`act-${ai}-step-${si}`))
    })
    setExpanded(keys)
  }, [data])

  // ===== MUTATION HELPERS =====
  const update = useCallback((mutator: (d: any) => void) => {
    setData((prev: any) => {
      const next = deepClone(prev)
      mutator(next)
      return next
    })
    markDirty()
  }, [markDirty])

  // Activity ops
  const addActivity = useCallback((afterIndex: number) => {
    update(d => {
      const newAct = {
        activity_id: makeId(), activity_title: 'New Activity', activity_type: 'exploration',
        activity_description: '', sequence_order: afterIndex + 2, estimated_duration_minutes: 10,
        teacher_modifiable: true, steps: [],
      }
      d.activities.splice(afterIndex + 1, 0, newAct)
    })
    setExpanded(prev => new Set([...prev, `act-${afterIndex + 1}`]))
  }, [update])

  const deleteActivity = useCallback((idx: number) => {
    if (!confirm('Delete this activity and all its steps?')) return
    update(d => d.activities.splice(idx, 1))
  }, [update])

  const moveActivity = useCallback((idx: number, dir: -1 | 1) => {
    const target = idx + dir
    update(d => {
      const [item] = d.activities.splice(idx, 1)
      d.activities.splice(target, 0, item)
    })
  }, [update])

  // Step ops
  const addStep = useCallback((actIdx: number, afterStepIdx: number) => {
    update(d => {
      const newStep = { ...deepClone(BLANK_STEP_TEMPLATE), step_id: makeId() }
      d.activities[actIdx].steps.splice(afterStepIdx + 1, 0, newStep)
    })
    setExpanded(prev => new Set([...prev, `act-${actIdx}`, `act-${actIdx}-step-${afterStepIdx + 1}`]))
  }, [update])

  const deleteStep = useCallback((actIdx: number, stepIdx: number) => {
    update(d => d.activities[actIdx].steps.splice(stepIdx, 1))
  }, [update])

  const moveStep = useCallback((actIdx: number, stepIdx: number, dir: -1 | 1) => {
    update(d => {
      const acts = d.activities
      const act = acts[actIdx]
      const targetIdx = stepIdx + dir

      if (targetIdx >= 0 && targetIdx < act.steps.length) {
        // Within same activity
        const [step] = act.steps.splice(stepIdx, 1)
        act.steps.splice(targetIdx, 0, step)
      } else if (dir === -1 && actIdx > 0) {
        // Move to prev activity (end)
        const [step] = act.steps.splice(stepIdx, 1)
        acts[actIdx - 1].steps.push(step)
      } else if (dir === 1 && actIdx < acts.length - 1) {
        // Move to next activity (start)
        const [step] = act.steps.splice(stepIdx, 1)
        acts[actIdx + 1].steps.unshift(step)
      }
    })
  }, [update])

  // Duplicate ops
  const duplicateActivity = useCallback((idx: number) => {
    update(d => {
      const clone = deepClone(d.activities[idx])
      clone.activity_id = makeId()
      clone.activity_title = (clone.activity_title || 'Activity') + ' (Copy)'
      clone.steps?.forEach((s: any) => { s.step_id = makeId() })
      d.activities.splice(idx + 1, 0, clone)
    })
    setExpanded(prev => new Set([...prev, `act-${idx + 1}`]))
  }, [update])

  const duplicateStep = useCallback((actIdx: number, stepIdx: number) => {
    update(d => {
      const clone = deepClone(d.activities[actIdx].steps[stepIdx])
      clone.step_id = makeId()
      clone.title = (clone.title || 'Step') + ' (Copy)'
      d.activities[actIdx].steps.splice(stepIdx + 1, 0, clone)
    })
    setExpanded(prev => new Set([...prev, `act-${actIdx}`, `act-${actIdx}-step-${stepIdx + 1}`]))
  }, [update])

  // ===== SAVE HANDLERS =====
  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (createMode) {
        const newLesson = await uploadLesson(data)
        toast.success('Lesson created')
        onClose()
        router.push(`/dashboard/lesson/${newLesson.id}`)
      } else {
        await updateLesson(lessonId!, data)
        setHasChanges(false)
        originalRef.current = JSON.stringify(data)
        toast.success('Lesson saved')
        router.refresh()
        onClose()
      }
    } catch (e: any) {
      toast.error(createMode ? 'Failed to create' : 'Failed to save', { description: e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAsCopy = async () => {
    setIsSaving(true)
    try {
      const newId = await duplicateLesson(lessonId!, data)
      toast.success('Lesson duplicated')
      onClose()
      router.push(`/dashboard/lesson/${newId}`)
    } catch (e: any) {
      toast.error('Failed to duplicate', { description: e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    if (hasChanges && !confirm('Discard all unsaved changes?')) return
    onClose()
  }

  // ===== RENDER HELPERS =====
  const isAdv = mode === 'advanced'

  const renderField = (label: string, value: any, onChange: (v: string) => void, type: 'input' | 'textarea' | 'number' = 'input') => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      {type === 'textarea' ? (
        <Textarea value={value || ''} onChange={e => onChange(e.target.value)} className="text-sm min-h-[80px]" />
      ) : type === 'number' ? (
        <Input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} className="text-sm w-32" />
      ) : (
        <Input value={value || ''} onChange={e => onChange(e.target.value)} className="text-sm" />
      )}
    </div>
  )

  const renderSelect = (label: string, value: string, options: string[], onChange: (v: string) => void) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-slate-600">{label}</Label>
      <Select value={value || ''} onValueChange={(v) => onChange(v || '')}>
        <SelectTrigger className="text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )

  // ===== STEP EDITOR =====
  const renderStepEditor = (actIdx: number, stepIdx: number, step: any) => {
    const setField = (field: string, val: any) => update(d => { d.activities[actIdx].steps[stepIdx][field] = val })
    const setMediaField = (field: string, val: any) => update(d => {
      if (!d.activities[actIdx].steps[stepIdx].interactive_or_media) {
        d.activities[actIdx].steps[stepIdx].interactive_or_media = { media_type: 'video', media_title: '', media_url: '', embed: true }
      }
      d.activities[actIdx].steps[stepIdx].interactive_or_media[field] = val
    })
    const setResponseField = (field: string, val: any) => update(d => {
      if (!d.activities[actIdx].steps[stepIdx].learner_response) {
        d.activities[actIdx].steps[stepIdx].learner_response = { response_required: true, response_type: 'text_short', prompt: '', placeholder: '' }
      }
      d.activities[actIdx].steps[stepIdx].learner_response[field] = val
    })
    const removeMedia = () => update(d => { delete d.activities[actIdx].steps[stepIdx].interactive_or_media })
    const removeResponse = () => update(d => { delete d.activities[actIdx].steps[stepIdx].learner_response })
    const addMedia = () => update(d => {
      d.activities[actIdx].steps[stepIdx].interactive_or_media = { media_type: 'video', media_title: '', media_url: '', embed: true }
    })
    const addResponse = () => update(d => {
      d.activities[actIdx].steps[stepIdx].learner_response = { response_required: true, response_type: 'open_ended', prompt: '', placeholder: '' }
    })

    const media = step.interactive_or_media
    const response = step.learner_response

    return (
      <div className="space-y-4">
        {/* Core */}
        {renderField('Title', step.title, v => setField('title', v))}
        {renderField('Instruction Text', step.instruction_text, v => setField('instruction_text', v), 'textarea')}
        {isAdv && renderSelect('Step Type', step.step_type || '', STEP_TYPES, v => setField('step_type', v))}

        {/* Media */}
        {media ? (
          <div className="border border-slate-100 rounded-lg p-3 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Film className="w-3 h-3" /> Media</span>
              <Button variant="ghost" size="sm" className="text-xs text-red-400 hover:text-red-600 h-6 px-2" onClick={removeMedia}>Remove</Button>
            </div>
            {renderSelect('Media Type', media.media_type || '', MEDIA_TYPES, v => setMediaField('media_type', v))}
            {renderField('Media Title', media.media_title, v => setMediaField('media_title', v))}
            {renderField('Media URL', media.media_url, v => setMediaField('media_url', v))}
            {isAdv && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`embed-${actIdx}-${stepIdx}`}
                    checked={media.embed !== false}
                    onCheckedChange={(c) => setMediaField('embed', !!c)}
                  />
                  <Label htmlFor={`embed-${actIdx}-${stepIdx}`} className="text-xs text-slate-600">Embed in iframe</Label>
                </div>
                {renderField('Instructions for Use', media.instructions_for_use, v => setMediaField('instructions_for_use', v), 'textarea')}
                {renderField('Media Source', media.media_source, v => setMediaField('media_source', v))}
              </>
            )}
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-blue-600 text-xs gap-1" onClick={addMedia}>
            <Film className="w-3 h-3" /> Add Media
          </Button>
        )}

        {/* Response */}
        {response ? (
          <div className="border border-slate-100 rounded-lg p-3 space-y-3 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Response</span>
              <Button variant="ghost" size="sm" className="text-xs text-red-400 hover:text-red-600 h-6 px-2" onClick={removeResponse}>Remove</Button>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`req-${actIdx}-${stepIdx}`}
                checked={response.response_required !== false}
                onCheckedChange={(c) => setResponseField('response_required', !!c)}
              />
              <Label htmlFor={`req-${actIdx}-${stepIdx}`} className="text-xs text-slate-600">Response Required</Label>
            </div>
            {renderSelect('Response Type', response.response_type || '', RESPONSE_TYPES, v => setResponseField('response_type', v))}
            {isAdv && renderField('Prompt', response.prompt, v => setResponseField('prompt', v))}
            {isAdv && renderField('Placeholder', response.placeholder, v => setResponseField('placeholder', v))}
            {isAdv && renderField('Max Length', response.max_length, v => setResponseField('max_length', v ? parseInt(v) : ''), 'number')}
            {(response.response_type === 'dropdown' || response.response_type === 'multiple_choice') && (
              <EditableList
                items={response.options || []}
                onChange={v => setResponseField('options', v)}
                label="Options"
              />
            )}
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="text-blue-600 text-xs gap-1" onClick={addResponse}>
            <MessageSquare className="w-3 h-3" /> Add Response
          </Button>
        )}

        {/* Advanced: source_reference */}
        {isAdv && renderField('Source Reference', step.source_reference, v => setField('source_reference', v))}
      </div>
    )
  }

  // ===== MAIN RENDER =====
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-6 mx-4 flex flex-col max-h-[calc(100vh-48px)]">

        {/* ===== STICKY TOP BAR ===== */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 rounded-t-2xl px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Pencil className="w-4 h-4 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">{createMode ? 'Create Lesson' : 'Edit Lesson'}</h2>
            {hasChanges && <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />}
          </div>

          <div className="flex items-center gap-2">
            {/* Mode switch */}
            <div className="hidden sm:flex items-center rounded-lg border border-slate-200 p-0.5 text-xs">
              <button
                onClick={() => setMode('default')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${mode === 'default' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Default
              </button>
              <button
                onClick={() => setMode('advanced')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${mode === 'advanced' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Advanced
              </button>
            </div>

            <Button variant="ghost" size="sm" onClick={expandAll} title="Expand all" className="hidden sm:flex p-1 h-7 w-7">
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll} title="Collapse all" className="hidden sm:flex p-1 h-7 w-7">
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </Button>

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <Button variant="outline" size="sm" onClick={handleDiscard} className="text-xs gap-1">
              <X className="w-3 h-3" /> Discard
            </Button>
            {!createMode && (
              <Button variant="outline" size="sm" onClick={handleSaveAsCopy} disabled={isSaving} className="text-xs gap-1 hidden sm:flex">
                <Copy className="w-3 h-3" /> Save as Copy
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="text-xs gap-1 bg-blue-600 hover:bg-blue-700">
              <Save className="w-3 h-3" /> {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>

        {/* ===== SCROLLABLE BODY ===== */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* === LESSON TITLE === */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Lesson Title</Label>
            <Input
              value={data.lesson_title || ''}
              onChange={e => update(d => { d.lesson_title = e.target.value })}
              className="text-xl font-semibold border-slate-200"
              placeholder="Lesson title"
            />
          </div>

          {/* === ABOUT ACCORDION === */}
          <Section
            id="about"
            title="About"
            expanded={expanded.has('about')}
            onToggle={() => toggle('about')}
            badges={
              !expanded.has('about') ? (
                <div className="flex gap-1.5 flex-wrap">
                  {data.grade_level && <Badge variant="secondary" className="text-[10px] py-0">{data.grade_level}</Badge>}
                  {data.difficulty_level && <Badge variant="secondary" className="text-[10px] py-0">{data.difficulty_level}</Badge>}
                  {data.estimated_duration_minutes && <Badge variant="secondary" className="text-[10px] py-0">{data.estimated_duration_minutes}min</Badge>}
                </div>
              ) : undefined
            }
          >
            {renderField('Description', data.lesson_description, v => update(d => { d.lesson_description = v }), 'textarea')}
            <div className="grid grid-cols-2 gap-4">
              {renderSelect('Grade Level', data.grade_level || '', GRADE_LEVELS, v => update(d => { d.grade_level = v }))}
              {renderSelect('Difficulty', data.difficulty_level || '', DIFFICULTY_LEVELS, v => update(d => { d.difficulty_level = v }))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderField('Source Reference', data.source_reference, v => update(d => { d.source_reference = v }))}
              {renderField('Duration (min)', data.estimated_duration_minutes, v => update(d => { d.estimated_duration_minutes = parseInt(v) || 0 }), 'number')}
            </div>
            <EditableList
              items={data.learning_objectives || []}
              onChange={v => update(d => { d.learning_objectives = v })}
              label="Learning Objectives"
            />
          </Section>

          {/* === ACTIVITIES === */}
          {data.activities?.map((activity: any, actIdx: number) => (
            <Section
              key={activity.activity_id || actIdx}
              id={`act-${actIdx}`}
              title={activity.activity_title || `Activity ${actIdx + 1}`}
              expanded={expanded.has(`act-${actIdx}`)}
              onToggle={() => toggle(`act-${actIdx}`)}
              badges={
                !expanded.has(`act-${actIdx}`) ? (
                  <div className="flex gap-1.5">
                    <Badge variant="secondary" className="text-[10px] py-0">{activity.activity_type || 'unknown'}</Badge>
                    <Badge variant="secondary" className="text-[10px] py-0">{activity.steps?.length || 0} steps</Badge>
                  </div>
                ) : undefined
              }
              actions={
                <ReorderButtons
                  onMoveUp={() => moveActivity(actIdx, -1)}
                  onMoveDown={() => moveActivity(actIdx, 1)}
                  onDelete={() => deleteActivity(actIdx)}
                  onAdd={() => addActivity(actIdx)}
                  onDuplicate={() => duplicateActivity(actIdx)}
                  canMoveUp={actIdx > 0}
                  canMoveDown={actIdx < data.activities.length - 1}
                />
              }
            >
              {/* Activity fields */}
              {renderField('Activity Title', activity.activity_title, v => update(d => { d.activities[actIdx].activity_title = v }))}
              {renderField('Description', activity.activity_description, v => update(d => { d.activities[actIdx].activity_description = v }), 'textarea')}
              <div className="grid grid-cols-2 gap-4">
                {renderSelect('Activity Type', activity.activity_type || '', ACTIVITY_TYPES, v => update(d => { d.activities[actIdx].activity_type = v }))}
                {renderField('Duration (min)', activity.estimated_duration_minutes, v => update(d => { d.activities[actIdx].estimated_duration_minutes = parseInt(v) || 0 }), 'number')}
              </div>

              {/* Steps inside this activity */}
              <div className="space-y-2 mt-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Steps</span>
                {activity.steps?.map((step: any, stepIdx: number) => (
                  <Section
                    key={step.step_id || stepIdx}
                    id={`act-${actIdx}-step-${stepIdx}`}
                    title={step.title || `Step ${stepIdx + 1}`}
                    expanded={expanded.has(`act-${actIdx}-step-${stepIdx}`)}
                    onToggle={() => toggle(`act-${actIdx}-step-${stepIdx}`)}
                    badges={
                      !expanded.has(`act-${actIdx}-step-${stepIdx}`) ? (
                        <div className="flex gap-1.5">
                          <Badge variant="secondary" className="text-[10px] py-0">{step.step_type || 'step'}</Badge>
                          {step.interactive_or_media && <Badge variant="secondary" className="text-[10px] py-0 bg-purple-50 text-purple-700"><Film className="w-2.5 h-2.5 mr-0.5" />media</Badge>}
                          {step.learner_response && <Badge variant="secondary" className="text-[10px] py-0 bg-green-50 text-green-700"><MessageSquare className="w-2.5 h-2.5 mr-0.5" />response</Badge>}
                        </div>
                      ) : undefined
                    }
                    actions={
                      <ReorderButtons
                        onMoveUp={() => moveStep(actIdx, stepIdx, -1)}
                        onMoveDown={() => moveStep(actIdx, stepIdx, 1)}
                        onDelete={() => deleteStep(actIdx, stepIdx)}
                        onAdd={() => addStep(actIdx, stepIdx)}
                        onDuplicate={() => duplicateStep(actIdx, stepIdx)}
                        canMoveUp={stepIdx > 0 || actIdx > 0}
                        canMoveDown={stepIdx < activity.steps.length - 1 || actIdx < data.activities.length - 1}
                      />
                    }
                  >
                    {renderStepEditor(actIdx, stepIdx, step)}
                  </Section>
                ))}
                <Button variant="ghost" size="sm" className="text-blue-600 text-xs gap-1 h-7" onClick={() => addStep(actIdx, (activity.steps?.length || 0) - 1)}>
                  <Plus className="w-3 h-3" /> Add Step
                </Button>
              </div>
            </Section>
          ))}

          {/* Add activity at end */}
          <Button variant="ghost" className="text-blue-600 text-sm gap-1 w-full border border-dashed border-blue-200 hover:bg-blue-50/50" onClick={() => addActivity((data.activities?.length || 0) - 1)}>
            <Plus className="w-4 h-4" /> Add Activity
          </Button>
        </div>
      </div>
    </div>
  )
}
