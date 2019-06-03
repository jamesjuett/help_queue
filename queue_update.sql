ALTER TABLE queueConfiguration ADD prioritizeNew CHAR;
CREATE INDEX ts_idx ON stack (email, ts);