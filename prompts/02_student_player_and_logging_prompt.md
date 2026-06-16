# Prompt: Create Student Player and Telemetry Logging System

Build a linear, step-based student lesson player, student registration/joining flow, server-side embed validation API, and telemetry logging system.

---

## 🚪 Student Joining Flow
1.  Create a student registration route (`/join/[code]`) that accepts an alphanumeric session join code in the URL.
2.  Provide a clean form asking the student for their **Name**.
3.  On submit, run a Server Action to:
    *   Verify the session code is valid and active in the database.
    *   Register the guest user by creating a row in the `students` table.
    *   Store the new `student_id` in secure cookies or local storage.
    *   Redirect the student to the player route: `/play/[code]`.

---

## 🎮 Linear Step Player Component

Create a client-side player component (`/play/[code]`) that renders a lesson session step-by-step.

### 1. Data Processing
*   Receive the lesson session JSON containing the `selected_steps_json` schema (activities and steps).
*   Flatten all steps across all activities into a single linear array.
*   Calculate total step count and track the current step index.

### 2. State & Navigation
*   Maintain `currentStepIndex` state.
*   Maintain `responses` state mapping `step_id` ➡️ `response_value` so student answers are preserved when navigating backward and forward.
*   Render navigation controls:
    *   **Back**: Moves to the previous step (disabled on step 1).
    *   **Primary CTA**: Renders context-sensitive actions:
        *   Context Step: `'Continue'`
        *   Question Step (with response): `'Submit Response'`
        *   Completion Screen: `'Finish Lesson'` or `'Next Activity'`
*   **Response Condition**: If the step specifies `response_required: true`, disable the Primary CTA until the student enters or selects a valid, non-empty response.

### 3. Layout Rules
Apply the following layout rules:

| Device Viewport | Layout Order |
|---|---|
| **Desktop / Tablet (Two-Column)** | **Left Column**: Media/Interactive/Simulation iframe (if present) <br> **Right Column**: Instructions, Response Fields, Progress Bar, Navigation Controls |
| **Mobile (Single Column Stacked)** | 1. Progress Bar & Instructions <br> 2. Media/Interactive/Simulation iframe (if present) <br> 3. Response input fields <br> 4. Navigation Controls & CTA |

*If no media or interactive asset is present on the step, collapse the layout to a single-column, centered, reading-focused container.*

---

## 🖥️ Step Rendering Rules

1.  **Context Step**: Renders step title and instructions. No inputs.
2.  **Response Step**: Renders the input control defined by `response_type`:
    *   `text_short`: Single-line text input.
    *   `text_long`: Multi-line text area.
    *   `multiple_choice`: Clickable radio cards (only one selection allowed).
    *   `dropdown`: Selection dropdown.
3.  **Media / Simulation Step**: Renders the asset in the Media column.
4.  **Completion Screen**: Displays a celebration/summary state and a close or continue CTA.

---

## 🛡️ Server-Side Embed Validation API

Create a Next.js API route `/api/check-embed` to verify if a URL is permitted to run in an iframe or if it will be blocked by headers:
1.  Execute a server-side `HEAD` request to the target URL with a timeout (e.g., 5s).
2.  Inspect headers for **`X-Frame-Options`** (`deny` or `sameorigin`).
3.  Inspect headers for **`Content-Security-Policy`** (`frame-ancestors 'none'` or `frame-ancestors 'self'`).
4.  If blocked, return `{ embeddable: false }`. Otherwise, return `{ embeddable: true }`.
5.  If a network error or timeout occurs, return `{ embeddable: true }` (optimistic allow fallback).

*Client Integration*: In the player, check the media URL against `/api/check-embed`. If `embeddable` is `false`, render a backup card with the media title, instructions, and an "Open in New Tab" link instead of the iframe container.

---

## 📡 Live Telemetry and Logging

Submit student telemetry via Server Actions or API routes:
1.  **Responses**: When the student clicks "Submit Response" on a question step, insert a new row in the `responses` table containing the `student_id`, `session_id`, `step_id`, and `response_value`.
2.  **Events**: Log interaction events in the `events` table:
    *   On loading a step containing media: insert `'media_started'`.
    *   On clicking external links: insert `'media_link_opened'`.

---

## ⚠️ Potential Failure Points & Mitigation

*   **Duplicate Submissions**: Double-clicking CTA could submit duplicate answers.
    *   *Mitigation*: Disable the Submit button and show a loading state immediately upon clicking.
*   **Cross-Domain Iframe Blockage**: Iframe content can run scripts that raise browser errors.
    *   *Mitigation*: Set the iframe `sandbox` attribute (`sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`) to restrict access while enabling basic operations.

---

## 🏁 Zero-Error Checklist

- [ ] Flat array mapping correctly maps step sequences 1-indexed to the user.
- [ ] Next button state updates dynamically when input changes.
- [ ] If media is missing, the player layout collapses to single-column without gaps.
- [ ] The `/api/check-embed` route runs `HEAD` requests rather than `GET` to conserve bandwidth.
- [ ] Guest student ID cookie/storage checks are validated before loading `/play/[code]` to prevent unauthenticated access.
