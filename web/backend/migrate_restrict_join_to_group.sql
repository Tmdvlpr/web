-- Add restrict_join_to_group flag to workspaces
-- When true: users joining via public invite_code (ws_{code}) must be members of the bound Telegram group
-- Personal invite_token links always bypass this check
ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS restrict_join_to_group BOOLEAN NOT NULL DEFAULT FALSE;
