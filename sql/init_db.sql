CREATE USER 'queue'@'localhost' IDENTIFIED BY 'devpass';
CREATE DATABASE queue;
GRANT SELECT, INSERT, UPDATE, DELETE ON queue.* TO 'queue'@'localhost';