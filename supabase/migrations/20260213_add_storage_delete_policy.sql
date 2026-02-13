-- Allow users to delete their own avatar
-- This policy allows a user to delete a file if they are the owner (based on the filename convention or path)
-- Since we name files as `{user_id}-{timestamp}.ext`, we can check if the file name starts with the user ID.
-- However, storage policies on `storage.objects` usually use `auth.uid()`.

-- Policy: Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
    -- Note: The implementation of `storage.foldername` or logic depends on how paths are structured.
    -- If files are in root of bucket: `name` is the filename.
    -- Our filenames are `${user.id}-${timestamp}.${ext}`.
    -- So we need to check if `name` starts with `auth.uid()`.
    -- A simpler robust way for root files matching pattern:
    -- (bucket_id = 'avatars' AND name LIKE (auth.uid() || '-%'))
);

-- Let's try the updated definition ensuring it matches our file naming scheme
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'avatars' AND 
    name LIKE (auth.uid() || '-%')
);
