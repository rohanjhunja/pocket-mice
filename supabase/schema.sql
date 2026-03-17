-- Enable the UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Lessons Table
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  json_content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 3. Sessions Table (active launched instances)
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_code TEXT UNIQUE NOT NULL, -- e.g. a short joining code
  selected_steps_json JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 4. Students Table (guests joining via session links)
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 5. Responses Table (student answers)
CREATE TABLE IF NOT EXISTS public.responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  step_id TEXT NOT NULL,
  response_value TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 6. Events Table (analytics / clicks)
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  step_id TEXT,
  event_type TEXT NOT NULL, -- e.g. 'media_started', 'media_clicked'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read and update their own profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Lessons: Teachers can read their own lessons, and create lessons
CREATE POLICY "Teachers can read own lessons" ON public.lessons FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own lessons" ON public.lessons FOR INSERT WITH CHECK (auth.uid() = teacher_id);

-- Sessions: Teachers can read/update their own sessions
-- Also allow public (student) access to read session details by session_id/session_code
CREATE POLICY "Teachers can manage own sessions" ON public.sessions FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "Anyone can view sessions" ON public.sessions FOR SELECT USING (true);

-- Students: Anyone can insert (to join). Teachers can read students of their sessions
CREATE POLICY "Anyone can register as a student" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read students" ON public.students FOR SELECT USING (true); 

-- Responses: Students can insert responses. Teachers can read responses.
CREATE POLICY "Anyone can insert responses" ON public.responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read responses" ON public.responses FOR SELECT USING (true); -- Usually restricted to teacher

-- Events: Students can insert. Teachers can read.
CREATE POLICY "Anyone can insert events" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read events" ON public.events FOR SELECT USING (true);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bookmarks UUID[] DEFAULT '{}';
