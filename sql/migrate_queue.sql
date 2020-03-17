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

alter table queue modify column location varchar(100) not null;
alter table stack modify column location varchar(100) not null;

create table appointments (
    id int not null auto_increment primary key,
    queueId int not null,
    staffEmail varchar(50) not null,
    studentEmail varchar(50),
    scheduledDate date not null,
    timeslot int not null,
    duration int not null,
    name varchar(50) not null,
    location varchar(100) not null,
    description varchar(100) not null,
    mapX float not null,
    mapY float not null
);

create table appointmentsSchedule (
    queueId int not null,
    day tinyint(4) not null,
    duration int not null,
    padding int not null,
    schedule varchar(288) not null,
    primary key (queueId, day)
);

alter table queues add column queueKind varchar(255) not null after courseId;

update queues set queueKind="ordered";
