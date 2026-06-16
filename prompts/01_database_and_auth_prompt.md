# Prompt: Create Database Schema and Authentication System

Create the database schema and authentication configuration for a multi-user learning activity platform using Supabase PostgreSQL.

---

## 🗄️ Database Tables Specification

Write a SQL schema script that creates the following tables and relationships:

### 1. `profiles`
*   **Purpose**: Extends the `auth.users` system table with custom user details.
*   **Columns**:
    *   `id` (`UUID`, Primary Key, References `auth.users` on delete cascade)
    *   `full_name` (`TEXT`)
    *   `role` (`TEXT`, Default `'teacher'`, Check constraint: `role IN ('admin', 'teacher')`)
    *   `bookmarks` (`UUID[]`, Default `'{ }'`) - References `lessons(id)`
    *   `created_at` (`TIMESTAMP WITH TIME ZONE`, Default `now()`)

### 2. `lessons`
*   **Purpose**: Holds metadata and structured JSON contents of lessons.
*   **Columns**:
    *   `id` (`UUID`, Primary Key, Default `uuid_generate_v4()`)
    *   `teacher_id` (`UUID`, References `profiles(id)` on delete cascade)
    *   `title` (`TEXT`, Not Null)
    *   `description` (`TEXT`)
    *   `tags` (`TEXT[]`)
    *   `json_content` (`JSONB`, Not Null)
    *   `created_at` (`TIMESTAMP WITH TIME ZONE`, Default `now()`)

### 3. `sessions`
*   **Purpose**: Active, launched instances of lessons assigned to a class.
*   **Columns**:
    *   `id` (`UUID`, Primary Key, Default `uuid_generate_v4()`)
    *   `lesson_id` (`UUID`, References `lessons(id)` on delete cascade)
    *   `teacher_id` (`UUID`, References `profiles(id)` on delete cascade)
    *   `session_code` (`TEXT`, Unique, Not Null) - Short alphanumeric code (e.g. "X8T4WZ") for student access.
    *   `selected_steps_json` (`JSONB`, Not Null) - Stores the subset of lesson activities/steps configured for this run.
    *   `status` (`TEXT`, Default `'active'`, Check: `status IN ('active', 'archived')`)
    *   `created_at` (`TIMESTAMP WITH TIME ZONE`, Default `now()`)

### 4. `students`
*   **Purpose**: Guest student entries registered when they join via a session room code.
*   **Columns**:
    *   `id` (`UUID`, Primary Key, Default `uuid_generate_v4()`)
    *   `session_id` (`UUID`, References `sessions(id)` on delete cascade)
    *   `name` (`TEXT`, Not Null)
    *   `joined_at` (`TIMESTAMP WITH TIME ZONE`, Default `now()`)

### 5. `responses`
*   **Purpose**: Individual student answers submitted during a session step.
*   **Columns**:
    *   `id` (`UUID`, Primary Key, Default `uuid_generate_v4()`)
    *   `student_id` (`UUID`, References `students(id)` on delete cascade)
    *   `session_id` (`UUID`, References `sessions(id)` on delete cascade)
    *   `step_id` (`TEXT`, Not Null)
    *   `response_value` (`TEXT`)
    *   `submitted_at` (`TIMESTAMP WITH TIME ZONE`, Default `now()`)

### 6. `events`
*   **Purpose**: Log user interaction and page visit events for analytics.
*   **Columns**:
    *   `id` (`UUID`, Primary Key, Default `uuid_generate_v4()`)
    *   `student_id` (`UUID`, References `students(id)` on delete cascade)
    *   `session_id` (`UUID`, References `sessions(id)` on delete cascade)
    *   `step_id` (`TEXT`)
    *   `event_type` (`TEXT`, Not Null) (e.g., `'media_started'`, `'page_viewed'`)
    *   `created_at` (`TIMESTAMP WITH TIME ZONE`, Default `now()`)

---

## ⚡ Automation Triggers

Implement a PostgreSQL function and trigger to automatically create a record in `public.profiles` whenever a new user signs up in Supabase (`auth.users`).

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🔐 Row Level Security (RLS) Policies

Enable RLS on all tables and apply these policy rules:
1.  **`profiles`**: Logged-in users can only select/update their own profile record.
2.  **`lessons`**: Teachers can only view/insert lessons where `teacher_id = auth.uid()`.
3.  **`sessions`**: Teachers can manage (`ALL`) their own sessions. Anyone (`SELECT` check `true`) can query session details using a code.
4.  **`students`**: Anyone can register (`INSERT`) as a student. Anyone can query (`SELECT`) registered student names (to verify classroom roster).
5.  **`responses`**: Anyone (unauthenticated students) can `INSERT` responses. Anyone can read (`SELECT`) responses.
6.  **`events`**: Anyone can `INSERT` telemetry events. Anyone can read (`SELECT`) telemetry.

---

## ⚠️ Potential Failure Points & Mitigation

*   **Next.js Server Actions RLS Errors**: Supabase Server Actions execute with a client that may not carry auth headers if initialized incorrectly, causing RLS to fail.
    *   *Mitigation*: Ensure the Supabase client inside Server Actions retrieves headers/cookies correctly (using `@supabase/ssr` or `cookies()` context).
*   **Trigger Failures on Social Sign-up**: If raw user metadata lacks `full_name`, the trigger must not fail.
    *   *Mitigation*: The trigger query handles null properties gracefully.

---

## 🏁 Zero-Error Checklist

- [ ] Script enables the `"uuid-ossp"` extension.
- [ ] Foreign keys cascade on delete to prevent orphaned references.
- [ ] Table `profiles` contains a checks constraint validating roles are only `'admin'` or `'teacher'`.
- [ ] RLS policies are enabled explicitly on all 6 tables using `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
- [ ] Trigger runs `AFTER INSERT` on `auth.users`.
