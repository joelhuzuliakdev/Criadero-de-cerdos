import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
    throw new Error(
        'Faltan las variables PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY. Revisá el archivo .env o la configuración del hosting.'
    );
}

export const supabase = createClient(url, key, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
});