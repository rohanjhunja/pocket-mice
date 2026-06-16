# Prompt: Create Teacher Dashboard and Session Analytics

Build a teacher-focused lesson management library and real-time live session analytics dashboard.

---

## 🗂️ Teacher Library Dashboard Layout
Create the main teacher landing page dashboard (`/dashboard`):
1.  **Recent Sessions list**: Grid showing session code, parent lesson title, registered student counts, date created, and links to session dashboards.
2.  **Lesson Catalog**: Filterable card grid of lessons.
    *   Search input field filtering title/description.
    *   Toggles for Bookmarked lessons and Global Library (shared lessons from other teachers).
3.  **Actions per Lesson**:
    *   **Duplicate**: Server action that clones a lesson under the active user's ID.
    *   **Delete**: Deletes owned lessons and associated sessions.
    *   **Launch Dialog**: Picker interface to configure room launches.

---

## 🚀 Session Launch Configurator Dialog

When launching a lesson, open a configurator Dialog that lets the teacher adjust the session scope before generating code:
1.  Query and render a nested checklist of all activities and steps inside the lesson.
2.  By default, check all checkboxes (full lesson launch).
3.  Allow the teacher to uncheck any steps or entire activities.
4.  On "Confirm", compile the payload (removing unchecked steps and activities) and write to the database:
    *   Insert a row in `sessions` table with the selected steps JSON in `selected_steps_json` and generating a unique alphanumeric room code.
    *   Redirect the teacher to the newly created `/dashboard/session/[id]` page.

---

## 📊 Live Session Analytics Dashboard

Create a real-time tracking dashboard (`/dashboard/session/[id]`) for teachers during live runs.

### 1. KPI Indicators Block
*   **Join Code Widget**: Display the session join code with a "Copy Link" helper.
*   ** Roster Metrics**:
    *   Active Students Count: count of student rows in this session.
    *   Total Submissions: count of response rows in this session.
    *   Completion Rate (%): calculated as `Math.round((responses / (students * expected_steps)) * 100)` (guard against division-by-zero).

### 2. Live Synchronization
Use Supabase Realtime Channels or client-side polling (every 5-10 seconds) to query updating students, responses, and events tables. The dashboard UI must sync updates dynamically without page refreshes.

### 3. Student Progress Roster Grid
Render a matrix grid layout mapping students to steps:
*   **Rows**: List of joined students.
*   **Columns**: Total steps in active session.
*   **Grid Cells**: Color-coded states:
    *   Grey: Step not reached yet (no view event logged).
    *   Yellow: Step viewed (view event logged, but no response submitted if required).
    *   Green: Step completed (response submitted or step completed event logged).

### 4. Interactive Step-by-Step Response Reviewer
Provide a list of all lesson steps showing student answer statistics:
*   For **Text** response types: Render an list showing student names and scrollable raw answers.
*   For **Multiple Choice / Dropdown** response types: Render a Recharts Bar Chart or Progress bars showing the frequency distribution of selected options.

---

## ⚠️ Potential Failure Points & Mitigation

*   **Divide-by-Zero Errors**: Completion rates calculation crash when the room is empty.
    *   *Mitigation*: Guard code with conditional expressions (e.g., `students === 0 ? 0 : ...`).
*   **Realtime Subscription Exhaustion**: Opening many dashboard tabs runs down database connections.
    *   *Mitigation*: Unsubscribe from realtime channels on component unmount (`useEffect` cleanup function).

---

## 🏁 Zero-Error Checklist

- [ ] Search input handles special regex characters without crashing search queries.
- [ ] Launch Configurator disables confirmation button if all steps are unchecked.
- [ ] Roster grid scales horizontally on screen sizes, using overflows or tables.
- [ ] Bookmark toggle saves bookmarks instantly in the database profile bookmarks array.
- [ ] Duplicate lesson copies details but tags it to the new `teacher_id`.
