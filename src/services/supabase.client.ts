import { createClient } from '@supabase/supabase-js';

// As credenciais do seu projeto Supabase.
// É seguro expor a chave 'anon public' no frontend.
// As regras de segurança são definidas no painel do Supabase (Row Level Security).
const supabaseUrl = 'https://mkxsnabjqqcljaqsunrz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1reHNuYWJqcXFjbGphcXN1bnJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1MTU4NDksImV4cCI6MjA3NjA5MTg0OX0.wTlUMAbtEGJ_qm09auSPsTr7CMj09qpUUqC9ksNeKeE';

export const supabase = createClient(supabaseUrl, supabaseKey);