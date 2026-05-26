-- ==========================================
-- SMP Instagram Content Automation Schema
-- Place this in your Supabase SQL Editor and run it.
-- ==========================================

-- 1. Create content_logs table
CREATE TABLE IF NOT EXISTS content_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    content_type TEXT NOT NULL, -- 'auto' or 'vision'
    target_gender TEXT NOT NULL, -- 'female' or 'male'
    concept TEXT NOT NULL,
    prompts JSONB NOT NULL, -- [{slide: 1, type: "BEFORE", prompt: "..."}, ...]
    caption TEXT NOT NULL,
    hashtags TEXT NOT NULL,
    approval_status TEXT NOT NULL DEFAULT 'pending' -- 'pending', 'approved', 'rejected'
);

-- 2. Create uploaded_images table (for reference, linking user photos)
CREATE TABLE IF NOT EXISTS uploaded_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_logs(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create user_sessions table to manage Telegram state machines (e.g. editing captions, waiting for photos)
CREATE TABLE IF NOT EXISTS user_sessions (
    chat_id TEXT PRIMARY KEY,
    state TEXT NOT NULL, -- 'idle', 'awaiting_photo', 'awaiting_caption_edit_<uuid>', 'awaiting_tags_edit_<uuid>'
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS and simple policies
ALTER TABLE content_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Disable strict RLS policies for rapid setup, allowing simple access from API
CREATE POLICY "Allow all actions for content_logs" ON content_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for uploaded_images" ON uploaded_images FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all actions for user_sessions" ON user_sessions FOR ALL USING (true) WITH CHECK (true);
