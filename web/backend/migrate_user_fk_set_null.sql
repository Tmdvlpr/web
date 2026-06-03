BEGIN;

ALTER TABLE video.meeting_participant_logs
    DROP CONSTRAINT meeting_participant_logs_user_id_fkey;
ALTER TABLE video.meeting_participant_logs
    ADD CONSTRAINT meeting_participant_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES dev.users(id) ON DELETE SET NULL;

ALTER TABLE video.meeting_chat_messages
    DROP CONSTRAINT meeting_chat_messages_user_id_fkey;
ALTER TABLE video.meeting_chat_messages
    ADD CONSTRAINT meeting_chat_messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES dev.users(id) ON DELETE SET NULL;

ALTER TABLE video.meeting_chat_files
    DROP CONSTRAINT meeting_chat_files_user_id_fkey;
ALTER TABLE video.meeting_chat_files
    ADD CONSTRAINT meeting_chat_files_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES dev.users(id) ON DELETE SET NULL;

COMMIT;
