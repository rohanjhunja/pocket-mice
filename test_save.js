const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: auth, error: err } = await supabase.auth.signInWithPassword({ email: 'admin@pocketmice.edu', password: 'admin' });
  const teacherId = auth.user.id;
  
  const { data: lesson } = await supabase.from('lessons').select('*').eq('teacher_id', teacherId).limit(1).single();
  let json = lesson.json_content;
  if (!json.activities[0].steps[0].interactive_or_media) {
    json.activities[0].steps[0].interactive_or_media = { media_type: 'simulation', media_title: 'Test', media_url: 'http://test.com', embed: true };
  }
  
  const { error: updErr } = await supabase.from('lessons').update({ json_content: json }).eq('id', lesson.id);
  if (updErr) console.error(updErr);
  
  const { data: lesson2 } = await supabase.from('lessons').select('*').eq('id', lesson.id).single();
  console.log("Saved Media:", lesson2.json_content.activities[0].steps[0].interactive_or_media);
}
test();
