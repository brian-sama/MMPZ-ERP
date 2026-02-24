import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ubolrymqivuzgnxmunsi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVib2xyeW1xaXZ1emdueG11bnNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzIwODUsImV4cCI6MjA4MjI0ODA4NX0.tg0mlUPu-trVjeMTTTCHrEuNSIc8TADEnlv1mlEADpU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('--- TESTING JOIN ---');
    const { data, error } = await supabase
        .from('indicators')
        .select(`
            *,
            owner:users!created_by_user_id(name)
        `)
        .limit(1);

    if (error) {
        console.log('JOIN_ERROR:', error.message);
        console.log('HINT:', error.hint);
    } else {
        console.log('JOIN_SUCCESS');
        console.log('Data:', JSON.stringify(data[0]));
    }
}

test();
