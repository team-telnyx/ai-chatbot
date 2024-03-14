CREATE TABLE IF NOT EXISTS conversations (
    session_id              VARCHAR(100) PRIMARY KEY,
    user_id                 VARCHAR(100) NOT NULL,
    created_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    message_id              VARCHAR(100) PRIMARY KEY,
    session_id              VARCHAR(100) NOT NULL,
    user_id                 VARCHAR(100) NOT NULL,
    user_message            character varying,
    processing_duration     float,
    show_help_action        boolean,
    show_feedback           boolean,
    error_title             character varying,
    error_detail            character varying,
    error_message           character varying,
    request_type            VARCHAR(50) NOT NULL DEFAULT 'stream',
    chatbot                 VARCHAR(50) NOT NULL DEFAULT 'chatbot',
    created_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    prompt_cost             float,
    completion_cost         float,
    CONSTRAINT fk_session_id FOREIGN KEY (session_id) REFERENCES conversations(session_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_completions (
    id                      VARCHAR(100) PRIMARY KEY,
    message_id              VARCHAR(100) NOT NULL,
    type                    character varying NOT NULL,
    system                  character varying,
    context                 character varying,
    answer                  character varying NOT NULL,
    model                   character varying NOT NULL,
    prompt_tokens           integer NOT NULL,
    completion_tokens       integer NOT NULL,
    duration                float NOT NULL,
    created_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT fk_message_id_chat_completions FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS tool_completions (
    id                      VARCHAR(100) PRIMARY KEY,
    message_id              VARCHAR(100) NOT NULL,
    system                  character varying NOT NULL,
    tool_name               character varying NOT NULL,
    tool_arguments          character varying,
    tool_output             character varying NOT NULL,
    model                   character varying NOT NULL,
    prompt_cost             float,
    completion_cost         float,
    prompt_tokens           integer NOT NULL,
    completion_tokens       integer NOT NULL,
    duration                float NOT NULL,
    created_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT fk_message_id_tool_completions FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
    document_id             VARCHAR(100) PRIMARY KEY,
    message_id              VARCHAR(100) NOT NULL,
    type                    VARCHAR(20) NOT NULL,
    url                     character varying NOT NULL,
    CONSTRAINT fk_message_id_documents FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback (
    id                      VARCHAR(100) PRIMARY KEY,
    message_id              VARCHAR(100) NOT NULL,
    user_id                 VARCHAR(100) NOT NULL,
    type                    VARCHAR(100),
    created_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT fk_message_id_feedback FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE CASCADE ON UPDATE CASCADE
);