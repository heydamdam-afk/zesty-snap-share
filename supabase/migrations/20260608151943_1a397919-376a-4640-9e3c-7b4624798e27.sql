CREATE POLICY "Users can read their own avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'zeste-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'zeste-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'zeste-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'zeste-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);