import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://nkujeixtehrkhqelqbpm.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rdWplaXh0ZWhya2hxZWxxYnBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NTgxNjcsImV4cCI6MjA4MDEzNDE2N30.H0soEVjKS8aduXspJqPoQ-LiOX-oLa9Z9aMCpybcqng';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
  }
});
