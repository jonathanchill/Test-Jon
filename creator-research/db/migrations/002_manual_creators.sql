-- Creators a person adds by hand (found in TikTok One, Instagram's creator
-- marketplace, or anywhere else), so they sit on the same list as the rest.
alter table brief_creators add column added_by text;
