# Prompt: Create a Web Interface for a Step-Based Learning Activity

Create a clean, responsive web interface for completing a lesson activity defined by a structured JSON.

The experience should feel focused, lightweight, and easy to progress through one step at a time.

---

## Goal

Build a step-based lesson player that allows a learner to:

- move through context pages, activity steps, and completion screens
- view progress across the lesson
- interact with embedded media, simulations, or assets where relevant
- submit responses when required
- move forward and backward through steps with clear navigation

The interface should support both desktop and mobile use.

---

## Input Data

The UI will be powered by a JSON structure with this hierarchy:

- lesson
  - activities[]
    - steps[]

Each step may include:

- `step_id`
- `step_type`
- `title`
- `instruction_text`
- `instruction_format`
- `interactive_or_media`
- `learner_response`
- `completion_condition`
- `source_reference`

---

## Core UI Requirements

### 1. Step-Based Flow
Create a single-step-at-a-time lesson interface.

The interface must support:
- context setting pages
- regular activity steps
- completion / wrap-up screens

Only one step should be shown at a time.

---

### 2. Progress Bar
Display a progress bar at the top of the interface.

It should indicate:
- total lesson progress across all steps
- current step number out of total steps
- optional current activity label

Example:
- `Step 4 of 18`
- progress bar filled proportionally

---

### 3. Layout Rules

#### Desktop / Tablet
Use a two-column layout:

- **Left column:** media / interactive / embedded asset
- **Right column:** instructions, response field, CTA

If no media or interactive is present:
- collapse to a single-column reading-focused layout
- keep content centered and compact

#### Mobile
Use a vertical stacked layout in this order:

1. instructions
2. media / interactive / asset
3. response field
4. CTA

This order is mandatory for mobile friendliness.

---

### 4. Information Hierarchy
Each step must display only the essential information needed to complete that step.

Show:
- step title
- short instruction text
- embedded media / simulation if included
- response input if required
- one clear primary CTA

Avoid:
- dense paragraphs
- unnecessary metadata
- multiple competing actions
- too many instructions at once

The UI should feel calm, obvious, and task-focused.

---

## Step Rendering Rules

### Context Step
Used when the learner only needs to read or understand something.

Display:
- title
- instruction text
- optional illustration/media if provided
- one CTA to continue

No input field unless explicitly defined.

---

### Response Step
Used when the learner must answer before moving ahead.

Display:
- title
- instruction text
- optional media / interactive if present
- response input area
- one primary CTA

CTA behavior:
- if a response is required, disable / grey out the CTA until input is provided
- once valid input is entered, enable the CTA

---

### Interactive / Media Step
Used when the learner must observe or use a simulation, video, image, or document.

Display:
- embedded interactive/media prominently
- short supporting instructions
- response field only if required by the step
- clear action to continue or submit

Media can include:
- video
- iframe simulation
- image
- external embedded asset
- document preview

---

### Completion Screen
Used to signal the end of an activity or lesson.

Display:
- clear completion message
- summary of progress completed
- simple success state
- one CTA such as:
  - `Continue`
  - `Next Activity`
  - `Finish Lesson`

Optional:
- celebration icon or minimal positive visual treatment

---

## Navigation Requirements

Include clear navigation controls for every step.

### Required Buttons
Support:
- `Back`
- `Next` or `Continue`
- `Submit` when a response is expected

### CTA Rules
There should be only **one primary CTA** visible for the required action.

Examples:
- context step → `Continue`
- response step → `Submit Response`
- completion step → `Next Activity`

Secondary navigation:
- `Back` may appear as a secondary button or text button
- do not show multiple primary buttons

### Disabled State
If the step expects a response:
- the primary CTA must appear greyed out and disabled until the learner enters a valid response

---

## Response Field Behavior

Support common response types such as:
- short text
- long text
- dropdown
- file upload
- multiple choice

Guidelines:
- use generous spacing
- clearly label the input
- show placeholder text if provided
- keep forms visually simple
- do not overload the learner with multiple inputs unless the step explicitly requires them

---

## Visual Style

Design the interface to feel:

- minimal
- modern
- distraction-free
- education-friendly
- mobile-first
- accessible

Prefer:
- soft surfaces
- strong spacing
- clean typography
- obvious hierarchy
- high contrast for readability
- sticky progress bar on top if useful

Avoid:
- dashboard-like clutter
- too many colors
- unnecessary decorative UI
- multiple panels competing for attention

---

## Interaction Design Notes

- Preserve learner focus on one step at a time
- Keep step transitions smooth and lightweight
- Make embedded media feel integrated, not detached
- Reduce cognitive load by revealing only what is needed now
- Ensure the learner always knows what to do next

---

## Component Structure

Suggested components:

- `LessonPlayer`
- `ProgressHeader`
- `StepRenderer`
- `InstructionPanel`
- `MediaPanel`
- `ResponseField`
- `NavigationBar`
- `CompletionCard`

---

## Step Logic

The UI should:
- read the ordered list of activities and steps from the JSON
- flatten or sequence them for display
- calculate total steps
- render the current step dynamically
- preserve learner response state per step
- allow backward navigation without losing entered responses

---

## Embedded Media Handling

If `interactive_or_media` exists:
- render it in the media area
- choose appropriate component by `media_type`

Examples:
- `video` → embedded video player
- `simulation` / `interactive` → iframe container
- `image` → responsive image
- `document` → file preview or download link

If media is absent:
- do not show an empty panel

---

## Accessibility and Usability

Ensure:
- keyboard-friendly navigation
- visible focus states
- readable font sizes
- responsive scaling
- clear disabled/enabled CTA states
- scroll handling for tall interactive content
- adequate padding around inputs and buttons

---

## Output Expectation

Create the interface as a polished, production-ready lesson player UI.

It should:
- work well for structured educational activities
- support context pages, question steps, simulations, and completion screens
- emphasize essential content only
- maintain a clear sense of learner progress
- use a two-column desktop layout and stacked mobile layout
- always present one obvious next action

---

## Final Design Principle

The learner should always be able to answer these three questions instantly:

1. What do I need to do on this step?
2. What do I interact with or respond to?
3. How do I move forward?

Design everything around that clarity.