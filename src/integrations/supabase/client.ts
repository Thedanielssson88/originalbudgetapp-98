import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dkuleyjinzrsdoghlftl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrdWxleWppbnpyc2RvZ2hsZnRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTgyMzQsImV4cCI6MjA2ODk3NDIzNH0.vBUEsmO8jaSHK7IBxIp960KvY6Kke5KAosphIM1DR2I';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);