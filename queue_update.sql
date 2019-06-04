ALTER TABLE queues ADD isActive INT DEFAULT 0;
ALTER TABLE queue ADD mapX INT;
ALTER TABLE queue ADD mapY INT;
ALTER TABLE stack ADD mapX INT;
ALTER TABLE stack ADD mapY INT;
CREATE TABLE queueConfiguration(queueId INT PRIMARY KEY, preventUnregistered CHAR, preventGroups CHAR);
