-- Allow users to update their own profile
-- This policy might already exist or be missing. We use DO block or ON CONFLICT-like logic if possible, 
-- but simpler is to just DROP and CREATE to be sure (or create consistent specific one).

-- 1. Ensure RLS is enabled on users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

-- 3. Policy: Users can view their own profile (and maybe others? usually public for avatar/name)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;
CREATE POLICY "Profiles are viewable by everyone"
ON public.users
FOR SELECT
USING ( true );
