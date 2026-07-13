import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

interface LearnerResponse {
  id: string
  response: string
}

export async function POST(request: NextRequest) {
  let body: { sessionId?: string; stepId?: string; checkCache?: boolean; forceRefresh?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { sessionId, stepId, checkCache, forceRefresh } = body

  if (!sessionId || !stepId) {
    return NextResponse.json(
      { error: 'sessionId and stepId are required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // 1. Verify caller is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Fetch session to verify ownership
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, teacher_id, lesson_id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.teacher_id !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden — you do not own this session' },
      { status: 403 }
    )
  }

  // 3. Fetch lesson content to get objectives and step info
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('json_content')
    .eq('id', session.lesson_id)
    .single()

  if (lessonError || !lesson || !lesson.json_content) {
    return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })
  }

  const jsonContent = lesson.json_content as any
  const learningGoals: string[] = jsonContent.learning_objectives || []

  // Extract step instruction and prompt
  const steps = (jsonContent.activities || []).flatMap((act: any) => act.steps || [])
  const targetStep = steps.find((s: any) => s.step_id === stepId)

  if (!targetStep) {
    return NextResponse.json({ error: 'Step not found in lesson' }, { status: 404 })
  }

  const stepTitle = targetStep.title || ''
  const instructionText = targetStep.instruction_text || ''
  const questionPrompt = targetStep.learner_response?.prompt || ''

  // 4. Fetch student responses
  const { data: responses, error: responsesError } = await supabase
    .from('responses')
    .select('id, response_value, student_id, submitted_at')
    .eq('session_id', sessionId)
    .eq('step_id', stepId)

  if (responsesError) {
    console.error('[summarize] responses fetch error', responsesError)
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
  }

  // Deduplicate latest response per student
  const sorted = [...(responses || [])].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  )
  const dedupedMap = new Map<string, any>()
  for (const r of sorted) {
    if (r.response_value?.trim()) {
      dedupedMap.set(r.student_id, r)
    }
  }
  const dedupedResponses = Array.from(dedupedMap.values())

  const currentCount = dedupedResponses.length
  const latestTimestamp =
    currentCount > 0
      ? new Date(
          Math.max(...dedupedResponses.map((r) => new Date(r.submitted_at).getTime()))
        ).toISOString()
      : null

  // 5. Query cached summary
  const { data: cached, error: cachedError } = await supabase
    .from('ai_summaries')
    .select('*')
    .eq('session_id', sessionId)
    .eq('step_id', stepId)
    .maybeSingle()

  // If checkCache is true, return whatever is cached (even if stale) without invoking Gemini.
  if (checkCache) {
    if (cached) {
      return NextResponse.json({
        summary: cached.summary_json,
        cached: true,
        count: cached.response_count,
        lastResponseAt: cached.last_response_at,
      })
    }
    return NextResponse.json({
      summary: null,
      cached: false,
      count: 0,
      lastResponseAt: null,
    })
  }

  const isTimestampMatch = (() => {
    if (!cached?.last_response_at && !latestTimestamp) return true
    if (!cached?.last_response_at || !latestTimestamp) return false
    return new Date(cached.last_response_at).getTime() === new Date(latestTimestamp).getTime()
  })()

  if (
    !forceRefresh &&
    cached &&
    cached.response_count === currentCount &&
    isTimestampMatch
  ) {
    return NextResponse.json({
      summary: cached.summary_json,
      cached: true,
      count: cached.response_count,
      lastResponseAt: cached.last_response_at,
    })
  }

  // If there are no responses, return empty structure immediately
  if (currentCount === 0) {
    return NextResponse.json({
      summary: { summaryPoints: [] },
      cached: false,
      count: 0,
      lastResponseAt: null,
    })
  }

  // 6. Compute new summary using Gemini API
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_KEY_MISSING' }, { status: 400 })
  }

  // Construct dynamic prompt sections
  const goalsStr =
    learningGoals.length > 0
      ? learningGoals.map((g) => `- ${g}`).join('\n')
      : 'None specified'

  const formattedResponses = dedupedResponses
    .map((r) => `Response ID: ${r.id}\nResponse: ${r.response_value}`)
    .join('\n\n---\n\n')

  const prompt = `You are an educational assistant analyzing learner responses to a question.
Consider the learning goals, question and all learner responses before identifying themes.
Group the responses into 3–5 distinct summary points that represent the most common ideas, interpretations, misconceptions, or approaches.

## Context

### Stated Learning Goals:
${goalsStr}

### Question / Step Prompt:
- Step Title: ${stepTitle}
- Instruction Text: ${instructionText}
- Question Prompt: ${questionPrompt}

### Learner Responses to Analyze (Total Count = ${currentCount}):
${formattedResponses}

---

## Analysis Requirements

1. **Group into 3-5 themes**: Group the responses into 3-5 distinct summary points that represent the most common ideas, interpretations, misconceptions, or approaches. Start each bullet item with a short title in the form of a student answer to the question, then describe what is observed among student responses.
2. **Summary Point Fields**: For each summary point, output:
   - A short title written in the form of a learner answer.
     Examples:
     - "It helps us visualise atomic structure."
     - "It is useful, but it is not the atom itself."
     - "Its meaning depends on context and prior knowledge."
   - A brief synthesis describing what is observed across the responses for that theme.
     Examples:
     - "Many students see the model as a useful simplification for showing electron shells, electron configuration, valence electrons, chemical stability, ion formation, and links to the periodic table or bonding."
     - "Several responses recognise the limitations of the representation: it does not show protons, neutrons, charge, scale, forces, probability clouds, or actual electron motion, and therefore cannot uniquely identify the particle."
     - "Students note that an 18th-century observer might interpret it as a planetary system, transport map, seating plan, or abstract symbol. This highlights how scientific models rely on shared conventions, labels, and teaching to generate curiosity and support reasoning."
   - The list of response IDs that are tagged under this summary point.
3. **Multi-tagging**: A response may receive more than one tag. Tag every learner response against all relevant summary points it matches.
4. **Insufficient Evidence**: Do not force a response into a category when there is insufficient evidence. Do not include any fallback categories or other summary text. Only output the main 3-5 theme points.
5. **Preserve Meaningful Differences**: Preserve meaningful differences between responses. Do not merge ideas merely because they use similar words.
6. **Distinguish Perspectives**: Distinguish between:
   - Correct or productive interpretations
   - Partial understanding
   - Misconceptions
   - Alternative or creative interpretations
   - Questions, uncertainty, or critique
7. **Evidence-Based**: Base every summary point only on evidence present in the learner responses. Do not introduce ideas that learners did not express.
8. **Tone**: Use neutral, non-judgemental language. Describe patterns rather than rating individual learners.
9. **Minority Perspectives**: Include minority or unusual perspectives when they reveal an important misconception, alternative interpretation, or useful line of inquiry.
10. **Learner Tagging Integrity**: Ensure that every learner ID appears exactly once in the tagging table, even when it has multiple tags.

---

## Output Format

You must return a valid JSON object matching the following JSON schema. Do not wrap the JSON output in markdown formatting like \`\`\`json or anything else. Just return the raw JSON string.
`

  const geminiPayload = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          summaryPoints: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                synthesis: { type: 'STRING' },
                matchingResponseIds: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                },
              },
              required: ['title', 'synthesis', 'matchingResponseIds'],
            },
          },
        },
        required: ['summaryPoints'],
      },
    },
  }

  // Helper: try each model in order, falling back on 429 quota errors
  const GEMINI_MODELS = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
  ]

  async function callGeminiWithFallback(): Promise<{ data: any; modelUsed: string }> {
    let lastError = ''
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload),
          cache: 'no-store',
        })
        const text = await res.text()
        if (res.ok) {
          try {
            const data = JSON.parse(text)
            return { data, modelUsed: model }
          } catch (jsonErr) {
            console.error(`[summarize] Failed to parse JSON from model ${model}:`, text)
            lastError = `JSON parse error on model ${model}`
            continue
          }
        }
        let parsedErr: any = {}
        try { parsedErr = JSON.parse(text) } catch {}
        const message = parsedErr?.error?.message || text
        console.warn(`[summarize] Model ${model} failed (${res.status}): ${message}`)
        lastError = `Model ${model} failed (${res.status}): ${message}`
      } catch (err: any) {
        console.warn(`[summarize] Fetch error on model ${model}: ${err.message}`)
        lastError = `Fetch error on model ${model}: ${err.message}`
      }
    }
    throw new Error(`All Gemini models failed. Last error: ${lastError}`)
  }

  try {
    let geminiData: any
    let modelUsed: string
    try {
      ;({ data: geminiData, modelUsed } = await callGeminiWithFallback())
      console.log(`[summarize] Generated summary using model: ${modelUsed}`)
    } catch (fallbackErr: any) {
      const msg: string = fallbackErr.message || 'Gemini call failed'
      const status = msg.startsWith('Quota exceeded') || msg.startsWith('All Gemini') ? 429 : 502
      return NextResponse.json({ error: msg }, { status })
    }

    const summaryText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!summaryText) {
      return NextResponse.json({ error: 'Empty response from Gemini' }, { status: 502 })
    }

    let parsedSummary: any
    try {
      parsedSummary = JSON.parse(summaryText)
    } catch (e) {
      console.error('[summarize] Failed to parse JSON from Gemini', summaryText)
      return NextResponse.json(
        { error: 'Invalid JSON structure returned by Gemini' },
        { status: 502 }
      )
    }

    // 7. Upsert to cache table
    const { error: upsertError } = await supabase.from('ai_summaries').upsert(
      {
        session_id: sessionId,
        step_id: stepId,
        summary_json: parsedSummary,
        response_count: currentCount,
        last_response_at: latestTimestamp,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'session_id,step_id',
      }
    )

    if (upsertError) {
      console.error('[summarize] Database cache upsert error', upsertError)
    }

    return NextResponse.json({
      summary: parsedSummary,
      cached: false,
      count: currentCount,
      lastResponseAt: latestTimestamp,
    })
  } catch (err: any) {
    console.error('[summarize] unexpected error', err)
    return NextResponse.json(
      { error: 'Internal Server Error', detail: err.message },
      { status: 500 }
    )
  }
}
