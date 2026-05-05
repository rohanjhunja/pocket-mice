const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function upload() {
  const { data: auth, error: err } = await supabase.auth.signInWithPassword({ email: 'admin@pocketmice.edu', password: 'admin' });
  if (err) {
    console.error('Login error:', err);
    return;
  }
  const teacherId = auth.user.id;
  
  const rawData = fs.readFileSync('lessons.local/lesson_wildfire.json');
  const doc = JSON.parse(rawData);
  
  // Apply safe defaults
  doc.activities?.forEach((a, ai) => {
    a.sequence_order = ai + 1;
    if (!a.activity_id) a.activity_id = `act_${ai + 1}`;
    if (!a.activity_type) a.activity_type = 'exploration';
    a.steps?.forEach((s, si) => {
      s.sequence_order = si + 1;
      if (!s.step_id) s.step_id = `step_${ai + 1}_${si + 1}`;
      if (!s.instruction_format) s.instruction_format = 'text';
      if (!s.completion_condition) {
        s.completion_condition = s.learner_response ? 'response_submitted' : 'next_button';
      }
      if (s.learner_response && !s.learner_response.response_type) {
        s.learner_response.response_type = 'text_short';
      }
    });
  });
  let totalSteps = 0;
  doc.activities?.forEach((a) => { totalSteps += a.steps?.length || 0; });
  doc.total_activity_count = doc.activities?.length || 0;
  doc.total_step_count = totalSteps;

  const insertData = {
    teacher_id: teacherId,
    title: doc.lesson_title || 'Untitled Upload',
    description: doc.lesson_description || doc.lesson_overview || '',
    tags: [],
    json_content: doc,
  };

  const { data, error } = await supabase
    .from('lessons')
    .insert(insertData)
    .select();

  if (error) {
    console.error('Insert error:', error.message);
  } else {
    console.log('Successfully uploaded lesson:', data[0].id);
  }
}

upload();
