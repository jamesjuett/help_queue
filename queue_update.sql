ALTER TABLE queueConfiguration ADD prioritizeNew CHAR;
CREATE INDEX ts_idx ON stack (email, ts);

CREATE TABLE queueAnnouncements (
    queueId INT PRIMARY KEY,
    announcement TEXT NOT NULL
);