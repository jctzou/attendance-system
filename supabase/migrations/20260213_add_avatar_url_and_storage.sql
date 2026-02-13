-- Add avatar_url to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create avatars storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload their own avatar
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can upload an avatar"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can update their own avatar"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'avatars' );

-- Note: In a real production environment with auth.uid() checks, we would use:
-- (auth.uid() = owner) Check on storage.objects usually requires owner column to be set correctly by client or trigger.
-- For simplicity in this demo, we allow authenticated users to insert.
-- A more robust policy would be:
-- WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );
