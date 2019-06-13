drop table queueAnnouncements;

create table announcements (
    id int not null auto_increment primary key,
    queueId int not null,
    message text not null,
    ts timestamp not null default CURRENT_TIMESTAMP
);

