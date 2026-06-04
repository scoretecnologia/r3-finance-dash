-- Permitir leitura pública (ou apenas para usuários autenticados) no bucket grupo-r3
CREATE POLICY "Permitir leitura pública no bucket grupo-r3"
ON storage.objects FOR SELECT
USING (bucket_id = 'grupo-r3');

-- Opcional: Se quiser restringir apenas para usuários autenticados:
-- CREATE POLICY "Permitir leitura autenticada no bucket grupo-r3"
-- ON storage.objects FOR SELECT TO authenticated
-- USING (bucket_id = 'grupo-r3');
