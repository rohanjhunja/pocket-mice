# Prompt: Create Interactive Lesson Editor and Simulation Uploader

Create a nested, state-safe visual Lesson Editor and a HTML simulation file uploader.

---

## 📝 Lesson Editor Component Layout & Interactions

Build the lesson editor UI as a modal overlay or page with a split configuration:
1.  **Lesson Metadata Accordion**: Title, Description, Grade Level, Difficulty, Learning Objectives, Estimated Duration.
2.  **Nested Activities list**:
    *   Re-orderable accordion panels.
    *   Actions per activity: Add New, Duplicate, Move Up, Move Down, Delete.
3.  **Nested Steps list** (inside each Activity):
    *   Sub-accordion panels.
    *   Actions per step: Add New, Duplicate, Move Up/Down (with ability to move steps across activity boundaries), Delete.
    *   Step properties form: Title, Instruction Text, Step Type badge, Media Attachment Block, Response Config Block.

---

## 🎨 Media & Response Blocks Configuration

### 1. Media Block
Allows adding video, simulation, content, or image URLs:
*   Provide a URL input field.
*   Provide a **"Choose"** button: Opens a grid modal of pre-loaded simulations fetched from the `simulations` database table. Selecting one applies its URL and title to the step's `interactive_or_media` properties.
*   Provide a **"Keep Previous"** shortcut button: Copies the media block from the nearest preceding step.

### 2. Response Block
Allows adding questions to steps:
*   Configure response required checkbox (`response_required`).
*   Select response type dropdown: `text_short`, `text_long`, `multiple_choice`, `dropdown`.
*   If `multiple_choice` or `dropdown` is selected, render an editable list component to add, edit, or delete selectable option strings.

---

## 📤 Simulation Uploader & Preview Workflow

Enable uploading HTML-based simulations directly into the lesson editor workflow:
1.  **Uploader Panel**: Add an "Upload Simulation" file input accepting `.html` files.
2.  **Sandbox Preview**: Once selected, render the HTML file inside a sandbox iframe using a local object URL (`URL.createObjectURL(file)`) so teachers can test the simulation before committing.
3.  **Metadata Input**: Provide a text field to edit the simulation's title.
4.  **Upload Submission**:
    *   On confirm, upload the file to Supabase Storage (bucket: `simulations`).
    *   Retrieve the public URL.
    *   Insert a row in the `simulations` database table.
    *   Select the newly created simulation and attach it to the active editor step.

---

## 💾 State Mutators & Normalization on Save

*   **State Safety**: Editing deeply nested JSON arrays requires deep cloning on mutation. Implement a wrapper mutator:
    ```typescript
    const update = (mutator: (data: any) => void) => {
      setData((prev: any) => {
        const next = JSON.parse(JSON.stringify(prev));
        mutator(next);
        return next;
      });
    };
    ```
*   **Normalization on Save**: Before sending the payload to the server, execute the following normalization logic:
    *   Compute activity `sequence_order` (1-indexed sequence).
    *   Compute step `sequence_order` (1-indexed within parent activity).
    *   Set unique string `activity_id` and `step_id` if blank.
    *   Auto-assign `completion_condition` (defaults to `response_submitted` if learner response is configured, otherwise `next_button`).
    *   Calculate `total_activity_count` and `total_step_count` (sum of all steps across all activities).

---

## ⚠️ Potential Failure Points & Mitigation

*   **Losing Unsaved Changes**: Users might accidentally close the editor.
    *   *Mitigation*: Maintain a dirty state boolean by checking if the current JSON stringified content matches the original content on mount. Show a confirm dialog if dirty when clicking "Discard/Close".
*   **React Key Drift**: Reordering components while using array indices as React keys causes input focus bugs.
    *   *Mitigation*: Generate stable unique IDs (e.g., using `uuid` or a random string generator) for every new activity and step. Use these IDs as React keys in list loops.

---

## 🏁 Zero-Error Checklist

- [ ] Drag-and-drop or button-based reordering updates sequence numbers correctly in state.
- [ ] Duplicate step function creates fresh unique keys/IDs for the clone to avoid duplication errors in the DB.
- [ ] Dropdown/multiple-choice inputs render error notices if options list is empty.
- [ ] Saving updates both the JSON columns and the synced flat database columns (e.g., `lessons.title`).
- [ ] File uploads restrict mime-types strictly to `.html` files.
