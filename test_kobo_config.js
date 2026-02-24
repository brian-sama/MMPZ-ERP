import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ubolrymqivuzgnxmunsi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVib2xyeW1xaXZ1emdueG11bnNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzIwODUsImV4cCI6MjA4MjI0ODA4NX0.tg0mlUPu-trVjeMTTTCHrEuNSIc8TADEnlv1mlEADpU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('--- TESTING KOBO_CONFIG ---');

    // Check if table exists and can be selected
    const { data: selectData, error: selectError } = await supabase.from('kobo_config').select('*');
    if (selectError) {
        console.log('SELECT_ERROR:', selectError.message);
    } else {
        console.log('SELECT_SUCCESS, Rows:', selectData.length);
    }

    // Try to insert
    const { data, error } = await supabase.from('kobo_config').insert([
        {
            server_url: 'https://test.com',
            api_token: 'test_token',
            is_connected: false
        }
    ]).select();

    if (error) {
        console.log('INSERT_ERROR:', error.message);
    } else {
        console.log('INSERT_SUCCESS');
        // Cleanup
        await supabase.from('kobo_config').delete().eq('server_url', 'https://test.com');
    }
}

test();
