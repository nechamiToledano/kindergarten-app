-- Two mismatched subdomains (syllable division, pattern continuation) needed
-- mechanics the existing 9 game types can't express — see the M12 spec audit.
ALTER TYPE "GameType" ADD VALUE 'SYLLABLE_COUNT';
ALTER TYPE "GameType" ADD VALUE 'PATTERN_SEQUENCE';
