-- Spec §5 asks for a 4th rating tier ("קיים עם תיווך") between PRESENT and
-- PARTIALLY_PRESENT, needed to rate physical/teacher-administered subdomains
-- (e.g. the wooden puzzle items) that the 3-level scale couldn't distinguish.
ALTER TYPE "Rating" ADD VALUE 'PRESENT_WITH_SUPPORT' AFTER 'PRESENT';
