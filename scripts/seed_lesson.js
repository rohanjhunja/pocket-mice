require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function seed() {
  console.log('Seeding lesson4...');

  console.log('Authenticating as admin...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@pocketmice.edu',
    password: 'admin',
  });

  if (authErr || !authData.user) {
    console.error('Failed to authenticate. Did you create the admin user?', authErr);
    process.exit(1);
  }

  // 1. Get the admin teacher profile
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'teacher')
    .limit(1);

  if (profileErr || !profiles || profiles.length === 0) {
    console.error('Error fetching admin profile. Did you create one in Supabase Auth?', profileErr);
    process.exit(1);
  }

  const teacherId = profiles[0].id;
  console.log(`Found teacher ID: ${teacherId}`);

  // 2. Read the JSON file
  const lessonPath = path.join(__dirname, '..', 'public', 'lesson4.json');
  const rawData = fs.readFileSync(lessonPath, 'utf-8');
  const lessonDataArray = JSON.parse(rawData);
  const lessonData = lessonDataArray[0];

  // 3. Upsert into lessons table
  const insertData = {
    teacher_id: teacherId,
    title: lessonData.lesson_title || 'Untitled Lesson',
    description: lessonData.lesson_overview || '',
    tags: ['Biology', 'Evolution', 'Science'], // Derived from context
    json_content: lessonData
  };

  const { data, error } = await supabase
    .from('lessons')
    .insert(insertData)
    .select();

  if (error) {
    console.error('Error inserting lesson:', error);
  } else {
    console.log('Successfully inserted lesson:', data[0].id);
  }
}

seed();
