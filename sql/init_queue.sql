-- MySQL dump 10.13  Distrib 5.5.62, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: queue
-- ------------------------------------------------------
-- Server version	5.5.62-0ubuntu0.14.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `queue`
--

DROP TABLE IF EXISTS `queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(50) NOT NULL,
  `queueId` int(11) NOT NULL,
  `name` varchar(30) NOT NULL,
  `location` varchar(50) NOT NULL,
  `mapX` float NOT NULL,
  `mapY` float NOT NULL,
  `description` varchar(100) NOT NULL,
  `ts` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=93147 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `queueAdmins`
--

DROP TABLE IF EXISTS `queueAdmins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queueAdmins` (
  `courseId` varchar(30) NOT NULL,
  `email` varchar(50) NOT NULL,
  PRIMARY KEY (`courseId`,`email`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queueAdmins`
--

LOCK TABLES `queueAdmins` WRITE;
/*!40000 ALTER TABLE `queueAdmins` DISABLE KEYS */;
INSERT INTO `queueAdmins` VALUES ('eecs280','jjuett@umich.edu'),('eecs280','jklooste@umich.edu');
/*!40000 ALTER TABLE `queueAdmins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `queueAnnouncements`
--

DROP TABLE IF EXISTS `queueAnnouncements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queueAnnouncements` (
  `queueId` int(11) NOT NULL,
  `announcement` text NOT NULL,
  PRIMARY KEY (`queueId`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queueAnnouncements`
--

LOCK TABLES `queueAnnouncements` WRITE;
/*!40000 ALTER TABLE `queueAnnouncements` DISABLE KEYS */;
INSERT INTO `queueAnnouncements` VALUES (1,'Office hours for Spring 2019 have been moved to 1695 BBB so we can enjoy the sunshine!<br />We are also trying out a new process for ordering the queue - for your first question each day, you\'ll get a boost closer to the top!');
/*!40000 ALTER TABLE `queueAnnouncements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `queueConfiguration`
--

DROP TABLE IF EXISTS `queueConfiguration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queueConfiguration` (
  `queueId` int(11) NOT NULL,
  `preventUnregistered` char(1) DEFAULT NULL,
  `preventGroups` char(1) DEFAULT NULL,
  `prioritizeNew` char(1) DEFAULT NULL,
  PRIMARY KEY (`queueId`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queueConfiguration`
--

LOCK TABLES `queueConfiguration` WRITE;
/*!40000 ALTER TABLE `queueConfiguration` DISABLE KEYS */;
INSERT INTO `queueConfiguration` VALUES (1,'n','n','y'),(7,'n','n','n'),(11,'n','n','n'),(12,'n','n','n'),(13,'n','n','n'),(14,'n','y','n'),(15,'n','n','n'),(16,'n','n','n'),(17,'n','n','n'),(18,'y','y','n'),(19,'n','y','n'),(20,'y','y','n'),(21,'n','n','n'),(22,'y','y','n'),(23,'n','n','n'),(24,'y','y','n');
/*!40000 ALTER TABLE `queueConfiguration` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `queueCourses`
--

DROP TABLE IF EXISTS `queueCourses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queueCourses` (
  `courseId` varchar(30) NOT NULL,
  `shortName` varchar(30) NOT NULL,
  `fullName` varchar(200) NOT NULL,
  PRIMARY KEY (`courseId`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queueCourses`
--

LOCK TABLES `queueCourses` WRITE;
/*!40000 ALTER TABLE `queueCourses` DISABLE KEYS */;
INSERT INTO `queueCourses` VALUES ('eecs280','EECS 280','Programming and Introductory Data Structures'),('engr101','ENGR 101','Introduction to Computers and Programming'),('engr151','ENGR 151','Accelerated Introduction to Computers and Programming'),('eecs485','EECS 485','Web Database and Information Systems'),('eecs490','EECS 490','Programming Languages'),('eecs183','EECS 183','Elementary Programming Concepts'),('eecs285','EECS 285','A Programming Language or Computer System');
/*!40000 ALTER TABLE `queueCourses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `queueGroups`
--

DROP TABLE IF EXISTS `queueGroups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queueGroups` (
  `queueId` int(11) NOT NULL DEFAULT '0',
  `email` varchar(50) NOT NULL DEFAULT '',
  `teammateEmail` varchar(50) NOT NULL DEFAULT '',
  PRIMARY KEY (`queueId`,`email`,`teammateEmail`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queueGroups`
--



--
-- Table structure for table `queueMessages`
--

DROP TABLE IF EXISTS `queueMessages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queueMessages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `postId` int(11) NOT NULL,
  `sender` varchar(50) NOT NULL,
  `target` varchar(50) NOT NULL,
  `message` text NOT NULL,
  `ts` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=3224 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;


--
-- Table structure for table `queueRoster`
--

DROP TABLE IF EXISTS `queueRoster`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queueRoster` (
  `queueId` int(11) NOT NULL DEFAULT '0',
  `email` varchar(50) NOT NULL DEFAULT '',
  PRIMARY KEY (`queueId`,`email`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;



--
-- Table structure for table `queueSchedule`
--

DROP TABLE IF EXISTS `queueSchedule`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queueSchedule` (
  `queueId` int(11) NOT NULL,
  `day` tinyint(4) NOT NULL,
  `schedule` char(48) NOT NULL,
  PRIMARY KEY (`queueId`,`day`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queueSchedule`
--

LOCK TABLES `queueSchedule` WRITE;
/*!40000 ALTER TABLE `queueSchedule` DISABLE KEYS */;
INSERT INTO `queueSchedule` VALUES (1,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(1,1,'cccccccccccccccccccccccccccpoooooocccccccccccccc'),(1,2,'cccccccccccccccccccccccccccpoooooocccccccccccccc'),(1,3,'cccccccccccccccccccccccccccpoooooocccccccccccccc'),(1,4,'ccccccccccccccccccccccccppppoooooocccccccccccccc'),(1,5,'cccccccccccccccccccccccccccpoooooooocccccccccccc'),(1,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(7,0,'oooooccccooooooooooooooooooooooooooooooooooooooo'),(7,1,'ocoocooooooooooooooooooooooooooooooooooooooooooo'),(7,2,'ocoococooooooooooooooooooooooooooooooooooooooooo'),(7,3,'occccooooooooooooooooooooooooooooooooooooooooooo'),(7,4,'ocoococooooooooooooooooooooooooooooooooooooooooo'),(7,5,'ocoococooooooooooooooooooooooooooooooooooooooooo'),(7,6,'oooooccccccccccccccccccccccooooooooooooooooooooo'),(11,0,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(11,1,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(11,2,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(11,3,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(11,4,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(11,5,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(11,6,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(13,0,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(13,1,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(13,2,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(13,3,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(14,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(13,4,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(13,5,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(13,6,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(14,1,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(14,2,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(14,3,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(14,4,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(14,5,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(14,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(12,0,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(12,1,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(12,2,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(12,3,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(12,4,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(12,5,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(12,6,'oooooooooooooooooooooooooooooooooooooooooooooooo'),(16,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(16,1,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(16,2,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(16,3,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(16,4,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(16,5,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(16,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(17,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(17,1,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(17,2,'cccccccccccccccccccccccccccccpoooooooooccccccccc'),(17,3,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(17,4,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(17,5,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(17,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(18,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(18,1,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(18,2,'cccccccccccccccccccccccccccccpoooooooooccccccccc'),(18,3,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(18,4,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(18,5,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(18,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(19,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(19,1,'cccccccccccccccccccccccccccpoooooooooooocccccccc'),(19,2,'cccccccccccccccccccccccccccpoooooooooooccccccccc'),(19,3,'cccccccccccccccccccccccccccpoooooooooooocccccccc'),(19,4,'cccccccccccccccccccccccccccpoooooooooooocccccccc'),(19,5,'cccccccccccccccccccccccccccpoooooooooooocccccccc'),(19,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(20,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(20,1,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(20,2,'cccccccccccccccccccccccccccccpoooooooooccccccccc'),(20,3,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(20,4,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(20,5,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(20,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(21,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(21,1,'cccccccccccccccccccccccccccpoooooooooooocccccccc'),(21,2,'cccccccccccccccccccccccccccpoooooooooooccccccccc'),(21,3,'cccccccccccccccccccccccccccpoooooooooooocccccccc'),(21,4,'cccccccccccccccccccccccccccpoooooooooooocccccccc'),(21,5,'cccccccccccccccccccccccccccpoooooooooooocccccccc'),(21,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(22,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(22,1,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(22,2,'cccccccccccccccccccccccccccccpoooooooooccccccccc'),(22,3,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(22,4,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(22,5,'cccccccccccccccccccccccooooccpoooooooooocccccccc'),(22,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(23,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(23,1,'cccccccccccccccccccpoooocccccccccccccccccccccccc'),(23,2,'ccccccccccccccccccpooooccccccccccccccccccccccccc'),(23,3,'ccccccccccccccccccccccccccccccpooooccccccccccccc'),(23,4,'cccccccccccccccccccccccpoooocccccccccccccccccccc'),(23,5,'cccccccccccccccccccccpoooooocccccccccccccccccccc'),(23,6,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(24,0,'cccccccccccccccccccccccccccccccccccccccccccccccc'),(24,1,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(24,2,'cccccccccccccccccccccccccccccpoooooooooccccccccc'),(24,3,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(24,4,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(24,5,'cccccccccccccccccccccccccccccpoooooooooocccccccc'),(24,6,'cccccccccccccccccccccccccccccccccccccccccccccccc');
/*!40000 ALTER TABLE `queueSchedule` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `queues`
--

DROP TABLE IF EXISTS `queues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `queues` (
  `queueId` int(11) NOT NULL AUTO_INCREMENT,
  `courseId` varchar(30) NOT NULL,
  `location` varchar(100) NOT NULL,
  `name` varchar(100) NOT NULL,
  `map` varchar(100) NOT NULL,
  `isActive` tinyint(1) NOT NULL,
  PRIMARY KEY (`queueId`)
) ENGINE=MyISAM AUTO_INCREMENT=25 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queues`
--

LOCK TABLES `queues` WRITE;
/*!40000 ALTER TABLE `queues` DISABLE KEYS */;
INSERT INTO `queues` VALUES (1,'eecs280','1695 BBB','Office Hours - 1695 BBB','',1),(12,'engr151','UGLi Basement','Office Hours - UGLi Basement','',1),(7,'engr101','B519 Pierpont','Office Hours','',1),(11,'engr151','1695 BBB','Office Hours - BBB1695','',1),(13,'engr151','B521 Pierpont','Office Hours - B521 Pierpont','',1),(14,'eecs485','1695 BBB','Office Hours - 1695 BBB','',1),(15,'eecs482','1695 BBB','Office Hours','',1),(16,'eecs490','blah','Office Hours','',1),(17,'eecs183','3rd Floor Duderstadt Center','Office Hours','dude_third_floor.png',0),(18,'eecs183','3rd Floor Duderstadt Center','Arduino - office hours','dude_third_floor.png',1),(19,'eecs183','3rd Floor Duderstadt Center','Connect 4 - office hours','dude_third_floor.png',0),(20,'eecs183','3rd Floor Duderstadt Center','Creative AI - office hours','dude_third_floor.png',1),(21,'eecs183','3rd Floor Duderstadt Center','iOS - office hours','dude_third_floor.png',0),(22,'eecs183','3rd Floor Duderstadt Center','DJ-183 - office hours','dude_third_floor.png',1),(23,'eecs285','N/A','Office Hours','',1),(24,'eecs183','3rd Floor Duderstadt Center','Elevator - office hours','dude_third_floor.png',1);
/*!40000 ALTER TABLE `queues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stack`
--

DROP TABLE IF EXISTS `stack`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `stack` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(50) NOT NULL,
  `queueId` int(11) NOT NULL,
  `name` varchar(30) NOT NULL,
  `location` varchar(50) NOT NULL,
  `mapX` float NOT NULL,
  `mapY` float NOT NULL,
  `description` varchar(100) NOT NULL,
  `ts` timestamp NULL DEFAULT NULL,
  `tsRemoved` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `removedBy` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ts_idx` (`email`,`ts`)
) ENGINE=MyISAM AUTO_INCREMENT=93143 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;


/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2019-06-08 15:03:35
