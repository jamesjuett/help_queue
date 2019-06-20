drop table queueAnnouncements;

create table announcements (
    id int not null auto_increment primary key,
    queueId int not null,
    content text not null,
    ts timestamp not null default CURRENT_TIMESTAMP
);

alter table queueConfiguration add column preventGroupsBoost char(1) after prioritizeNew;