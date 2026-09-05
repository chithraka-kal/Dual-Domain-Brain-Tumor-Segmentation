-- ==============================================================================
-- SUPABASE DATABASE SCHEMA FOR DUAL-DOMAIN BRAIN TUMOR SEGMENTATION PORTAL
-- Run this script in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================================================

-- Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. PUBLIC PROFILES TABLE (Linked to auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    organization TEXT,
    role TEXT DEFAULT 'Researcher',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically create a public profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------------------------
-- 2. INFERENCE SESSIONS TABLE (Saves History, Images & Notes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inference_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    filename TEXT NOT NULL,
    volume_shape TEXT DEFAULT '240×240×155',
    display_slice INT DEFAULT 77,
    original_image TEXT,
    baseline_image TEXT,
    dual_domain_image TEXT,
    ground_truth_image TEXT,
    baseline_dice JSONB,
    dual_domain_dice JSONB,
    wt_dsc_dual FLOAT,
    inference_time_seconds FLOAT,
    device TEXT DEFAULT 'CPU',
    notes TEXT
);

-- Add image columns if table already exists
ALTER TABLE public.inference_sessions ADD COLUMN IF NOT EXISTS original_image TEXT;
ALTER TABLE public.inference_sessions ADD COLUMN IF NOT EXISTS baseline_image TEXT;
ALTER TABLE public.inference_sessions ADD COLUMN IF NOT EXISTS dual_domain_image TEXT;
ALTER TABLE public.inference_sessions ADD COLUMN IF NOT EXISTS ground_truth_image TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inference_sessions_user_id ON public.inference_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_inference_sessions_created_at ON public.inference_sessions(created_at DESC);


-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inference_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Inference Sessions Policies (History & Notes)
CREATE POLICY "Users can view own sessions" ON public.inference_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.inference_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.inference_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.inference_sessions FOR DELETE USING (auth.uid() = user_id);
