drop table queueAnnouncements;

create table announcements (
    id int not null auto_increment primary key,
    queueId int not null,
    content text not null,
    ts timestamp not null default CURRENT_TIMESTAMP
);

alter table queueConfiguration add column preventGroupsBoost char(1) after prioritizeNew;

alter table queue add column priority int not null default 0 after description;
alter table stack add column priority int not null default 0 after description;

CREATE INDEX queueGroups_email ON queueGroups(email);

create table appointments (
    id int not null auto_increment primary key,
    queueId int not null,
    staffEmail varchar(50) not null,
    studentEmail varchar(50),
    startTime datetime not null,
    duration int not null
);