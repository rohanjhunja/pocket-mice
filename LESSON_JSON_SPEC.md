# Lesson JSON Output Specification

This document defines the expected structure of a Pocket Mice lesson JSON object. It describes the purpose of every field and the rules governing valid values. No examples are provided — only rules.

---

## Root Structure

The JSON may be a single object or an array of objects. Each object represents one **lesson**.

| Field | Type | Required | Purpose |
|---|---|---|---|
| `lesson_id` | `string` | No | Unique identifier for the lesson. Auto-generated on save if empty. |
| `lesson_title` | `string` | Yes | Display name shown in the dashboard and player header. Synced to the `lessons.title` DB column on save. |
| `lesson_description` | `string` | No | Overview text displayed on the lesson overview page. Synced to `lessons.description` on save. |
| `source_reference` | `string` | No | Free-text attribution or citation for the lesson source material. Not displayed to learners. |
| `estimated_duration_minutes` | `integer` | No | Approximate total lesson duration in minutes. Displayed on overview page as metadata. |
| `difficulty_level` | `string` | No | Freeform difficulty label. Not enforced by the player. |
| `grade_level` | `string` | No | Freeform grade level label. Not enforced by the player. |
| `learning_objectives` | `string[]` | No | List of learning objective strings. Displayed on the lesson overview page. |
| `total_activity_count` | `integer` | No | Auto-computed on save. Equals the length of `activities`. Do not set manually. |
| `total_step_count` | `integer` | No | Auto-computed on save. Equals the sum of all steps across all activities. Do not set manually. |
| `activities` | `Activity[]` | Yes | Ordered list of activity objects. Must contain at least one activity for the lesson to be playable. |

---

## Activity Object

Each element in `activities` represents a grouped sequence of steps.

| Field | Type | Required | Purpose |
|---|---|---|---|
| `activity_id` | `string` | No | Unique identifier. Auto-generated on save if empty. |
| `activity_title` | `string` | Yes | Display name shown in the accordion header of the lesson overview and editor. |
| `activity_type` | `string` | No | Freeform label for categorization (e.g., `exploration`, `simulation`, `assessment`). Displayed as a badge. Not used for player logic. Defaults to `exploration` if empty on save. |
| `activity_description` | `string` | No | Descriptive text for the activity. Displayed on the overview page under the activity heading. |
| `sequence_order` | `integer` | No | Auto-computed on save. 1-indexed position of this activity in the lesson. Do not set manually. |
| `estimated_duration_minutes` | `integer` | No | Approximate duration for this activity. Displayed as metadata. |
| `teacher_modifiable` | `boolean` | No | Reserved flag for future use. Does not affect current behavior. |
| `steps` | `Step[]` | Yes | Ordered list of step objects. Steps are flattened across all activities at play time into a single linear sequence. |

---

## Step Object

Each element in `steps` represents one screen in the player. Steps are the atomic unit of the lesson — the player displays one step at a time and allows linear forward/backward navigation.

### Core Fields

| Field | Type | Required | Purpose |
|---|---|---|---|
| `step_id` | `string` | No | Unique identifier. Auto-generated on save if empty. Must be unique across the entire lesson. Used as the key for response submission; changing it after students have responded will orphan their responses. |
| `title` | `string` | Yes | Displayed as the heading in the instruction overlay during play. |
| `instruction_text` | `string` | Yes | The main body text shown to the learner in the instruction overlay. Supports plain text only. |
| `instruction_format` | `string` | No | Reserved. Defaults to `text` on save. Currently only `text` is rendered. |
| `sequence_order` | `integer` | No | Auto-computed on save. 1-indexed position of this step within its parent activity. Do not set manually. |

### Advanced Fields

These fields are exposed only in Advanced editing mode. They have no effect on player behavior if left empty.

| Field | Type | Required | Purpose |
|---|---|---|---|
| `step_type` | `string` | No | Freeform label (e.g., `context`, `question`, `media`, `completion`). Displayed as a badge in the editor. **Not used for player rendering logic** — the player determines what to show based on the presence of `interactive_or_media` and `learner_response` objects, not this field. |
| `source_reference` | `string` | No | Free-text attribution for this specific step. Not displayed to learners. |

### Completion Condition

| Field | Type | Required | Purpose |
|---|---|---|---|
| `completion_condition` | `string \| object` | No | Defaults to `next_button` if no `learner_response` is present, or `response_submitted` if one is present. Auto-set on save if empty. The player does not currently enforce `minimum_interaction_time_seconds` or complex condition objects — advancement is always allowed via button click or response submission. |

---

## Interactive or Media Object (`interactive_or_media`)

Optional. When present on a step, the player renders a media background behind the instruction overlay.

| Field | Type | Required | Purpose |
|---|---|---|---|
| `media_type` | `string` | Yes | Determines player rendering behavior. Must be one of: `video`, `simulation`, `content`, `image`. |
| `media_title` | `string` | No | Displayed as the accessible label for the media embed. |
| `media_url` | `string` | Yes | The URL to embed or link. Must be a valid absolute URL. For YouTube, must use the embed format (`youtube.com/embed/...`). The player will attempt an iframe embed first; if the URL fails embed validation, it falls back to a "open in new tab" link. |
| `media_source` | `string` | No | Freeform label indicating the origin (e.g., `youtube`, `external`). Not used for player logic. |
| `embed` | `boolean` | No | Defaults to `true`. When `false`, the player skips the iframe and shows a direct link instead. |
| `instructions_for_use` | `string` | No | Additional guidance for the learner about how to interact with the media. Exposed only in Advanced editing mode. Not currently displayed in the player. |

### Media Type Behavior

| `media_type` | Player Behavior |
|---|---|
| `video` | Embeds in iframe. Activates dark theme for the player background. |
| `simulation` | Embeds in iframe at full height. No theme change. |
| `content` | Embeds in iframe. Standard theme. |
| `image` | Embeds in iframe. Standard theme. |

All types go through server-side embed validation (`/api/check-embed`). If the URL is blocked by `X-Frame-Options` or CSP headers, the player shows an instruction overlay with a "open in new tab" button instead.

---

## Learner Response Object (`learner_response`)

Optional. When present on a step, the player renders a response input inside the instruction overlay.

| Field | Type | Required | Purpose |
|---|---|---|---|
| `response_required` | `boolean` | No | Defaults to `true` when present. When `true`, the "Submit" button is disabled until the learner provides a non-empty value. When `false`, the button reads "Continue" and allows skipping. |
| `response_type` | `string` | Yes | Determines the input control rendered. Must be one of the values below. |
| `prompt` | `string` | No | If non-empty, displayed as a label above the input control. If empty or absent, no label is shown. Advanced editing mode only. |
| `placeholder` | `string` | No | Placeholder/hint text inside the input control. Advanced editing mode only. |
| `max_length` | `integer` | No | Character limit for text inputs. Enforced via the HTML `maxLength` attribute. Advanced editing mode only. |
| `options` | `string[]` | Conditional | Required when `response_type` is `dropdown` or `multiple_choice`. Each element is one selectable option. Must contain at least one non-empty string. |

### Response Type Behavior

| `response_type` | Rendered Control | Notes |
|---|---|---|
| `text_short` | Single-line `<input>` | Default fallback if `response_type` is empty or unrecognized. |
| `text_long` | Multi-line `<textarea>` | Minimum height of 100px, resizable. |
| `multiple_choice` | Radio-style option cards | Each option renders as a clickable card with a radio indicator. Only one selection allowed. Requires `options` array. |
| `dropdown` | `<select>` dropdown menu | Renders a dropdown selector. Requires `options` array. |

### Legacy Response Types

The player also accepts these legacy values for backward compatibility. They are automatically normalized at render time:

| Legacy Value | Normalized To |
|---|---|
| `open_ended` | `text_long` |
| `short_answer` | `text_short` |

New lessons should use the canonical values (`text_short`, `text_long`, `multiple_choice`, `dropdown`).

---

## Auto-Populated Defaults on Save

The following fields are automatically set by the server actions (`updateLesson`, `uploadLesson`) if they are empty or missing. Authors do not need to set these manually.

| Field | Default Value | Condition |
|---|---|---|
| `activity_id` | `act_{index}` | When empty |
| `activity_type` | `exploration` | When empty |
| `step_id` | `step_{actIndex}_{stepIndex}` | When empty |
| `instruction_format` | `text` | When empty |
| `completion_condition` | `response_submitted` if `learner_response` exists, else `next_button` | When empty |
| `learner_response.response_type` | `text_short` | When response object exists but type is empty |
| `total_activity_count` | Count of activities | Always recomputed |
| `total_step_count` | Sum of all steps | Always recomputed |
| `sequence_order` (activity) | 1-indexed position | Always recomputed |
| `sequence_order` (step) | 1-indexed position within activity | Always recomputed |

---

## Key Rules

1. **Step identity**: `step_id` is the primary key for response storage. If a step's `step_id` changes after a session has been launched, previous responses for that step become orphaned and will not appear in analytics.
2. **Player rendering is structure-driven, not type-driven**: The player does not rely on `step_type` to decide what to render. It checks for the presence of `interactive_or_media` (→ render media) and `learner_response` (→ render input). A step with both renders both. A step with neither renders only the instruction text and a Continue button.
3. **Flat playback**: At play time, all activities are flattened into a single ordered list of steps. Activity boundaries are not visible to learners during play.
4. **Response versioning**: Every response submission creates a new row in the `responses` table (INSERT, not UPSERT). The most recent submission per `step_id` is used for display; all submissions are retained for audit.
5. **Embed validation**: All media URLs are validated server-side before embedding. URLs that fail validation are presented as external links instead.
6. **Options requirement**: `options` array is mandatory and must contain at least one entry when `response_type` is `dropdown` or `multiple_choice`. If `options` is empty or missing for these types, the control will render with no selectable choices.
