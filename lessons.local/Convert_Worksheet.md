# Converting Worksheets to Lesson JSON

This document provides instructions on how to reliably convert educational PDF worksheets into the structured JSON format required by the Pocket Mice platform.

**Reference:** Always ensure the output validates against the structural requirements defined in `../LESSON_JSON_SPEC.md`.

## Guiding Principles

1. **Keep it Basic:** Use only the most essential fields to represent the instructional content. 
2. **Advanced Fields Only When Necessary:** Avoid using advanced options (like custom `completion_condition` rules, `step_type`, `placeholder` or `prompt`) unless you explicitly need them to fulfill a specific instructional requirement of the worksheet.
3. **Flat Step Sequence:** Remember that during playback, all steps in all activities are presented sequentially. Group related questions into activities, but break down large chunks of information into individual `instruction_text` steps.

## Conversion Rules

### Step 1: Root Lesson Object
1. **`lesson_title`**: Extract the main title of the worksheet.
2. **`lesson_description`**: If there is an introductory paragraph or summary, use it here. Otherwise, omit.
3. **`activities`**: Create an array to hold the activities.

*Note: Omit `lesson_id`, `total_activity_count`, `total_step_count`. They will be auto-generated or calculated by the platform.*

### Step 2: Formulating Activities
Group naturally related sections of the worksheet into Activities.
1. **`activity_title`**: Use the section headers from the worksheet (e.g., "Part 1: Introduction", "Activity A: Data Collection").
2. **`steps`**: Extract the content of the section into a sequence of steps.

### Step 3: Extracting Steps
Each distinct piece of information, media, or question from the worksheet becomes **one step**.

**Rule 3A: Information / Text Blocks**
If the worksheet simply presents information to read:
- **`title`**: Provide a brief, descriptive heading.
- **`instruction_text`**: Paste the text content verbatim.
- *Do not add `learner_response` or `interactive_or_media`.*

**Rule 3B: Media / Diagrams / Simulations**
If the worksheet asks the student to interact with a specific external resource (link, video, or simulation):
- **`title`**: Name the media (e.g., "Watch the Video").
- **`instruction_text`**: Any accompanying reading instructions.
- Add an `interactive_or_media` object:
  - **`media_type`**: `video` (for YouTube), `simulation` (for interactive models), or `content`/`image` (for web articles/images).
  - **`media_url`**: The absolute URL to the resource.

**Rule 3C: Questions / Prompts**
If the worksheet asks a question that requires a student answer:
- **`title`**: A short label for the question (e.g., "Question 1", "Observation").
- **`instruction_text`**: The text of the question itself.
- Add a `learner_response` object:
  - **`response_type`**: 
    - Use `text_short` for fill-in-the-blank or basic factual recall.
    - Use `text_long` for explanations, observations, or multi-sentence answers.
    - Use `multiple_choice` or `dropdown` ONLY if the worksheet explicitly lists selectable options.
  - If using `multiple_choice` or `dropdown`, you MUST provide the `options` array containing the exact choices.
  - *Keep advanced properties (`placeholder`, `prompt`, `max_length`) omitted unless strictly needed for clarity.*

## Example Process Flow
1. **Title:** "Photosynthesis Basics" -> `lesson_title`.
2. **Paragraph 1:** "Read about plants in the sun." -> New Step in Activity 1. `instruction_text` = "Read about plants in the sun."
3. **Question 1:** "What gas do plants absorb?" -> New Step in Activity 1. `instruction_text` = "What gas do plants absorb?". `learner_response` added with `response_type`: `text_short`.
4. **Question 2:** "Why is it important?" -> New Step in Activity 1. `instruction_text` = "Why is it important?". `learner_response` added with `response_type`: `text_long`.
