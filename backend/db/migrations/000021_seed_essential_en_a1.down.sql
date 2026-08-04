-- Remove Essential English A1 pack seed (keep shared words/senses that may be in use).
delete from curriculum_pack_entries
where pack_id = 'a0000000-0000-4000-8000-0000000000a1'::uuid;

delete from curriculum_packs
where id = 'a0000000-0000-4000-8000-0000000000a1'::uuid;
