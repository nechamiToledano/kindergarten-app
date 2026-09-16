-- Optional ungraded worked-example config, shown before the scored trial for
-- subdomains the spec asks to demonstrate first (§9 audit, Phase 4).
ALTER TABLE "Subdomain" ADD COLUMN "demoConfig" JSONB;
