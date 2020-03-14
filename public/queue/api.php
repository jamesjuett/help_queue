<?php

require_once 'vendor/autoload.php';

$GLOBALS["config"] = parse_ini_file("../../php/queue/php.config");

require_once '../../php/queue/auth.php';

function dbConnect() {
    $db = new PDO('mysql:host=127.0.0.1;dbname=queue', $GLOBALS["config"]["db_username"], $GLOBALS["config"]["db_password"]);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $db;
}

$app = new \Slim\Slim(array(
    'mode' => $GLOBALS["config"]["server_mode"]
));

// Only invoked if mode is "production"
$app->configureMode('production', function () use ($app) {
    $app->config(array(
        'log.enable' => true,
        'debug' => false
    ));
});

// Only invoked if mode is "development"
$app->configureMode('development', function () use ($app) {
    $app->config(array(
        'log.enable' => false,
        'debug' => true
    ));
});


function isQueue($db, $queueId) {
    $stmt = $db->prepare('SELECT * from queues WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);

    $stmt->execute();
    return $stmt->rowCount() > 0;
}

function isCourse($db, $course) {
    $stmt = $db->prepare('SELECT * from queueCourses WHERE courseId=:course');
    $stmt->bindParam('course', $course);

    $stmt->execute();
    return $stmt->rowCount() > 0;
}

function isQueueAdmin($db, $email, $queueId) {
    $stmt = $db->prepare('SELECT * from queues, queueAdmins WHERE queueId=:queueId AND queues.courseId = queueAdmins.courseID AND email=:email');
    $stmt->bindParam('email', $email);
    $stmt->bindParam('queueId', $queueId);

    $stmt->execute();
    return $stmt->rowCount() > 0;
}

function isCourseAdmin($db, $email, $courseId) {
    $stmt = $db->prepare('SELECT * from queueAdmins WHERE courseId=:courseId AND email=:email');
    $stmt->bindParam('email', $email);
    $stmt->bindParam('courseId', $courseId);

    $stmt->execute();
    return $stmt->rowCount() > 0;
}

function getQueueConfiguration($db, $queueId) {
    $stmt = $db->prepare('SELECT * FROM queueConfiguration WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);
    $stmt->execute();
    return $stmt->fetch(PDO::FETCH_OBJ);
}

function isTeammateSignedUp($db, $email, $queueId) {
    $stmt = $db->prepare('SELECT * FROM queue, queueGroups WHERE queue.queueId=:queueId AND queue.queueId=queueGroups.queueId AND queueGroups.teammateEmail=queue.email AND queueGroups.email=:email');
    $stmt->bindParam('queueId', $queueId);
    $stmt->bindParam('email', $email);
    $stmt->execute();
    return $stmt->rowCount() > 0;
}


// Determine whether there's a resolved request from this user today.
// (Note the use of ts rather than tsResolved means this technically depends
//  on whether the request was originally submitted today, not whether it was resolved today.)
function onStackToday($db, $email, $queueId) {
    $date = new DateTime();
    $date->setTime(0, 0); // 12AM today
    $dayBeginning = $date->getTimestamp();

    $query = 'SELECT * FROM stack WHERE stack.queueId = :queueId ';
    $query .= 'AND stack.email = :email AND UNIX_TIMESTAMP(stack.ts) >= :dayBeginning';
    $stmt = $db->prepare($query);
    $stmt->bindParam('queueId', $queueId);
    $stmt->bindParam('email', $email);
    $stmt->bindParam('dayBeginning', $dayBeginning);
    $stmt->execute();
    return $stmt->rowCount() != 0;
}

// Determine whether any teammates were helped today
function teammateOnStackToday($db, $email, $queueId) {
    $date = new DateTime();
    $date->setTime(0, 0); // 12AM today
    $dayBeginning = $date->getTimestamp();

    $query = 'SELECT * FROM stack, queueGroups WHERE stack.queueId = :queueId '
             . 'AND queueGroups.queueId = stack.queueId AND queueGroups.email = :email '
             . 'AND queueGroups.teammateEmail=stack.email AND UNIX_TIMESTAMP(stack.ts) >= :dayBeginning';
    $stmt = $db->prepare($query);
    $stmt->bindParam('queueId', $queueId);
    $stmt->bindParam('email', $email);
    $stmt->bindParam('dayBeginning', $dayBeginning);
    $stmt->execute();
    return $stmt->rowCount() != 0;
}

function isSignUpProhibited($db, $email, $queueId) {

    // Admins are always allowed to sign up
    if (isQueueAdmin($db, $email, $queueId)) {
        return array(
            'prohibited'=>false
        );
    }

    // get queue configuration
    $queueConfig = getQueueConfiguration($db, $queueId);

    if ($queueConfig->preventUnregistered === "y") {
        // if student is not registered, then sign up is not allowed
        $stmt = $db->prepare('SELECT * FROM queueRoster WHERE queueId=:queueId AND email=:email');
        $stmt->bindParam('queueId', $queueId);
        $stmt->bindParam('email', $email);
        $stmt->execute();
        if ($stmt->rowCount() == 0) {
            return array(
                'prohibited'=>true,
                'reason'=>'You must be registered on the autograder in order to sign up for this queue.'
            );
        }
    }

    if ($queueConfig->preventGroups === "y") {
        // if a teammate is signed up, then we are not allowed to sign up
        if (isTeammateSignedUp($db, $email, $queueId)) {
            return array(
                'prohibited'=>true,
                'reason'=>'You may not sign up at the same time as one of your project group members.'
            );
        }
    }

    return array(
        'prohibited'=>false
    );
}

function getCurrentHalfHour() {
    return intval(floor((60 * (int)date("H") + (int)date("i")) /  30)); // intdiv not until php 7
}

// Returns a 48-character string that indicates the status of the queue
// for each half hour in the 7 days of the week. Returns an array of strings
// "o": open
// "c": closed
// "p": pre-open (can sign up, but not open yet)
function getQueueSchedule($db, $queueId) {

    $stmt = $db->prepare('SELECT schedule from queueSchedule WHERE queueId=:queueId ORDER BY day ASC');
    $stmt->bindParam('queueId', $queueId);

    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

// Returns a 48-character string that indicates the status of the queue
// for each half hour in the specified day.
// "o": open
// "c": closed
// "p": pre-open (can sign up, but not open yet)
function getQueueScheduleDay($db, $queueId, $day) {

    $stmt = $db->prepare('SELECT schedule from queueSchedule WHERE queueId=:queueId AND day = :day');
    $stmt->bindParam('queueId', $queueId);
    $stmt->bindParam('day', $day);

    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $res = $stmt->fetch(PDO::FETCH_OBJ);
        return $res->schedule;
    }
    else {
        return str_repeat("o", 48);
    }

}

function getQueueScheduleToday($db, $queueId) {

    // Find day of the week 0-6
    $day = (int)date("w");

    return getQueueScheduleDay($db, $queueId, $day);
}

// Returns whether the queue is open for the current half hour (numbered 0-47).
// Will return true if the queue is either truly open or in a pre-open state.
function isQueueOpen($db, $queueId) {

    // get the schedule of half hours for today
    $schedule = getQueueScheduleToday($db, $queueId);

    // Find the "half-hour-index" where every half hour in the week is numbered 0-47
    $halfHour = getCurrentHalfHour();

    // check the current half hour and return
    return $schedule[$halfHour] == "o" || $schedule[$halfHour] == "p";
}

function getQueueAnnouncements($db, $queueId) {

    $stmt = $db->prepare('SELECT * from announcements WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);

    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $res = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return $res;
    }
    else {
        return [];
    }

}


// POST request to login
$app->post('/api/login', function () use ($app){

    $idtoken = $app->request->post('idtoken');
    loginUser($idtoken);

});

// Sanitize any information about a queue request that came from the user
function sanitizeQueueRequest(
    &$email,
    &$id, // might be a numeric ID for either a queue or a specific queue request
    &$name,
    &$location,
    &$mapX,
    &$mapY,
    &$description)
{
    $id = intval($id);
    $email = htmlspecialchars($email);
    $name = htmlspecialchars($name);
    $location = htmlspecialchars($location);
    $mapX = floatval($mapX);
    $mapY = floatval($mapY);
    $description = htmlspecialchars($description);

}


function determinePriorityForNewRequest($db, $email, $queueId) {

    $config = getQueueConfiguration($db, $queueId);

    // Default: all priorities are the same
    if ($config->prioritizeNew === "n") {
        return 0;
    }

    $getsBoost = !onStackToday($db, $email, $queueId);

    if ($config->preventGroupsBoost === "y") {
        $getsBoost = $getsBoost && !isTeammateSignedUp($db, $email, $queueId);
        $getsBoost = $getsBoost && !teammateOnStackToday($db, $email, $queueId);
    }


    if ($getsBoost) {
        return 1; // first question per day gets higher priority
    }
    else {
        return 0;
    }
}

// POST request for sign up
$app->post('/api/signUp', function () use ($app){

    //$idtoken = $app->request->post('idtoken');
    $email = getUserEmail();

    // Ensure it's an @umich.edu address
    $rightmostAtPos = strrpos($email, '@');
    if (!(substr($email, -10) == '@umich.edu')){
        echo json_encode(array(
            'fail'=>'fail',
            'reason'=>'Only @umich.edu accounts are allowed.'
        ));
        return;
    }

    $queueId = $app->request->post('queueId');
    $name = $app->request->post('name');
    $location = $app->request->post('location');
    $mapX = $app->request->post('mapX');
    $mapY = $app->request->post('mapY');
    $description = $app->request->post('description');

    sanitizeQueueRequest($email, $queueId, $name, $location, $mapX, $mapY, $description);

    // Open database connection
    $db = dbConnect();

    // Ensure the queue exists
    assert(isQueue($db, $queueId));

    // Ensure the user is not already signed up or prohibited (admins excluded)
    if (!isQueueAdmin($db, $email, $queueId)) {

        // Check if they're already signed up
        $stmt = $db->prepare('SELECT id FROM queue WHERE email=:email AND queueId=:queueId');
        $stmt->bindParam('email', $email);
        $stmt->bindParam('queueId', $queueId);
        $stmt->execute();

        if ($stmt->rowCount() != 0){
            echo json_encode(array(
                'fail'=>'fail',
                'reason'=>'You may not sign up more than once for the same course.'
            ));
            return;
        }

        // Check if they're prohibited from signing up
        $prohibitedResult = isSignUpProhibited($db, $email, $queueId);
        if ($prohibitedResult['prohibited']) {
            echo json_encode(array(
                'fail'=>'fail',
                'reason'=>$prohibitedResult['reason']
            ));
            return;
        }
    }

    // Ensure the queue is open (admins excluded) TODO: actually exclude admins currently
    //if (!isQueueAdmin($db, $email, $queueId)) {
        if (!isQueueOpen($db, $queueId)){
            echo json_encode(array(
                'fail'=>'fail',
                'reason'=>'The queue is currently closed.'
            ));
            return;
        }
    //}


    $priority = determinePriorityForNewRequest($db, $email, $queueId);

    $stmt = $db->prepare('INSERT INTO queue (email, queueId, name, location, mapX, mapY, description, priority) values (:email, :queueId, :name, :location, :mapX, :mapY, :description, :priority)');

    $stmt->bindParam('email', $email);
    $stmt->bindParam('queueId', $queueId);
    $stmt->bindParam('name', $name);
    $stmt->bindParam('location', $location);
    $stmt->bindParam('mapX', $mapX);
    $stmt->bindParam('mapY', $mapY);
    $stmt->bindParam('description', $description);
    $stmt->bindParam('priority', $priority);

    $stmt->execute();

    echo json_encode(array(
        'success'=>'success'
    ));
    return;
});

// POST request to update a help request on the queue
$app->post('/api/updateRequest', function () use ($app){

    $email = getUserEmail();

    $id = $app->request->post('id');
    $name = $app->request->post('name');
    $location = $app->request->post('location');
    $mapX = $app->request->post('mapX');
    $mapY = $app->request->post('mapY');
    $description = $app->request->post('description');

    sanitizeQueueRequest($email, $id, $name, $location, $mapX, $mapY, $description);

    $db = dbConnect();

    // Find the queue that the help request belongs to
    $stmt = $db->prepare('SELECT queueId from queue where id=:id');
    $stmt->bindParam('id', $id);
    $stmt->execute();

    // If there is no such queue, halt
    if ($stmt->rowCount() == 0) {
        $app->halt(403);
        return;
    }

    // get the queue id from the DB result
    $res = $stmt->fetch(PDO::FETCH_OBJ);
    $queueId = $res->queueId;

    // If they're not an admin...
    if (!isQueueAdmin($db, $email, $queueId)) {

        // check if they're updating themselves
        $stmt = $db->prepare('SELECT email from queue where id=:id');
        $stmt->bindParam('id', $id);
        $stmt->execute();
        $res = $stmt->fetch(PDO::FETCH_OBJ);
        $posterEmail = $res->email;

        // If not an admin, and not updating themselves, halt
        if ($email != $posterEmail){
            $app->halt(403);
            return;
        }

    };

    // Note: do not set email here, otherwise if an admin updates the request it would then have their email attached
    $stmt = $db->prepare('UPDATE queue set name = :name, location = :location, mapX = :mapX, mapY = :mapY, description = :description where id = :id');
    $stmt->bindParam('id', $id);
    $stmt->bindParam('name', $name);
    $stmt->bindParam('location', $location);
    $stmt->bindParam('mapX', $mapX);
    $stmt->bindParam('mapY', $mapY);
    $stmt->bindParam('description', $description);
    $stmt->execute();

    echo json_encode(array(
        'success'=>'success'
    ));
});


// POST request to see which courses a user is an admin for
$app->post('/api/adminCourses', function () use ($app){

    //$idtoken = $app->request->post('idtoken');
    $email = getUserEmail();

    $db = dbConnect();

    $stmt = $db->prepare('SELECT courseId FROM queueAdmins WHERE email=:email');
    $stmt->bindParam('email', $email);
    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_OBJ);
    echo json_encode($res);
});



// POST request to remove from queue
$app->post('/api/remove', function () use ($app){

    $email = getUserEmail();

    $id = $app->request->post('id');

    $db = dbConnect();

    $stmt = $db->prepare('SELECT queueId from queue where id=:id');
    $stmt->bindParam('id', $id);
    $stmt->execute();

    if ($stmt->rowCount() != 0) {
        $res = $stmt->fetch(PDO::FETCH_OBJ);
        $queueId = $res->queueId;

        // Must be an admin for the course
        if (!isQueueAdmin($db, $email, $queueId)) {

            // or it's ok if they're removing themselves
            $stmt = $db->prepare('SELECT email from queue where id=:id');
            $stmt->bindParam('id', $id);
            $stmt->execute();
            $res = $stmt->fetch(PDO::FETCH_OBJ);
            $posterEmail = $res->email;

            if ($email != $posterEmail){
                $app->halt(403);
                return;
            }

        };

        $stmt = $db->prepare('INSERT INTO stack (email, queueId, name, location, description, priority, ts, mapX, mapY, removedBy) SELECT queue.email, queue.queueId, queue.name, queue.location, queue.description, queue.priority, queue.ts, queue.mapX, queue.mapY, :remover from queue where id=:id');
        $stmt->bindParam('id', $id);
	    $stmt->bindParam('remover', $email);
        $stmt->execute();

        $stmt = $db->prepare('DELETE FROM queue WHERE id=:id');
        $stmt->bindParam('id', $id);
        $stmt->execute();
    }
});

// POST request to send message to a user who has made a request
$app->post('/api/sendMessage', function () use ($app){

    //$idtoken = $app->request->post('idtoken');
    $email = getUserEmail();

    $id = htmlspecialchars($app->request->post('id')); // Not really necessary
    $message = htmlspecialchars($app->request->post('message'));

    $db = dbConnect();

    $stmt = $db->prepare('SELECT queueId, email from queue where id=:id');
    $stmt->bindParam('id', $id);
    $stmt->execute();

    if ($stmt->rowCount() != 0) {
        $res = $stmt->fetch(PDO::FETCH_OBJ);
        $queueId = $res->queueId;
        $target = $res->email;

        // Must be an admin for the course
        if (!isQueueAdmin($db, $email, $queueId)) {
            $app->halt(403);
            return;
        }

        $stmt = $db->prepare('INSERT INTO queueMessages values (NULL, :postId, :sender, :target, :message, NULL)');
        $stmt->bindParam('postId', $id);
        $stmt->bindParam('sender', $email);
        $stmt->bindParam('target', $target);
        $stmt->bindParam('message', $message);
        $stmt->execute();
    }
});

// POST request to remove ALL requests from a queue
$app->post('/api/clear', function () use ($app){

    //$idtoken = $app->request->post('idtoken');
    $email = getUserEmail();

    $queueId = $app->request->post('queueId');

    $db = dbConnect();

    // Must be an admin for the course
    if (!isQueueAdmin($db, $email, $queueId)) { $app->halt(403); return; };

    $stmt = $db->prepare('DELETE FROM queue WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);
    $stmt->execute();
});

function buildQueueListQuery($config, $queueId, $isAdmin) {

    $query = "SELECT id, ";
    if ($isAdmin) {
        $query .= "email, name, location, mapX, mapY, description, ";
    }
    $query .= 'priority, UNIX_TIMESTAMP(ts) as ts';

    // order by priority, then by timestamp
    $query .= ' FROM queue WHERE queueId=:queueId ORDER BY priority DESC, ts';

    return $query;
}

function postprocessQueueListResult($config, &$res) {
    if ($config->prioritizeNew === "y") {
        for ($i = 0; $i < count($res); $i++) {
            if ($res[$i]['priority'] > 0) {
                $res[$i]['tag'] = '<span class="glyphicon glyphicon-arrow-up"></span> First Question Today!';
            }
        }
    }
}

function addOwnQueueInfo($db, $queueId, &$res) {
    if (isUserLoggedIn()){
        $email = getUserEmail();

        // Add additional information for themselves
        $stmt = $db->prepare('SELECT id, email, name, location, mapX, mapY, description, UNIX_TIMESTAMP(ts) as ts FROM queue WHERE queueId=:queueId AND email=:email');
        $stmt->bindParam('queueId', $queueId);
        $stmt->bindParam('email', $email);
        $stmt->execute();

        if ($stmt->rowCount() != 0){
            $individual = $stmt->fetch(PDO::FETCH_ASSOC);
            for ($i = 0; $i < count($res); $i++) {
                if ($res[$i]['id'] == $individual['id']) {
                    $res[$i]['email'] = $individual['email'];
                    $res[$i]['name'] = $individual['name'];
                    $res[$i]['location'] = $individual['location'];
                    $res[$i]['mapX'] = $individual['mapX'];
                    $res[$i]['mapY'] = $individual['mapY'];
                    $res[$i]['description'] = $individual['description'];
                }
            }
        }

    }
}

function getQueueList($db, $queueId) {
    
    $config = getQueueConfiguration($db, $queueId);

    if (isUserLoggedIn()){
        $email = getUserEmail();

        if (isQueueAdmin($db, $email, $queueId)) {
            $stmt = $db->prepare(buildQueueListQuery($config, $queueId, true));
            $stmt->bindParam('queueId', $queueId);
            $stmt->execute();

            $res = $stmt->fetchAll(PDO::FETCH_ASSOC);

            postprocessQueueListResult($config, $res);

            return $res;
        }
    }

    $stmt = $db->prepare(buildQueueListQuery($config, $queueId, false));
    $stmt->bindParam('queueId', $queueId);
    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_ASSOC);

    postprocessQueueListResult($config, $res);

    addOwnQueueInfo($db, $queueId, $res);

    return $res;
}

// POST request for entries in a particular queue
// request details (e.g. location, etc.) are only given to admins
$app->post('/api/list/', function () use ($app) {

    $db = dbConnect();

    $queueId = $app->request->post('queueId');

    // Ensure the queue exists
    assert(isQueue($db, $queueId));

    $list = getQueueList($db, $queueId);
    $res = array("queue" => $list);

    // Check to see if they have any messages
    if (isUserLoggedIn()) {
        $email = getUserEmail();
        $stmt = $db->prepare('SELECT id, sender, message, UNIX_TIMESTAMP(ts) as ts FROM queueMessages WHERE target=:email ORDER BY ts LIMIT 1');
        $stmt->bindParam('email', $email);
        $stmt->execute();

        if ($stmt->rowCount() != 0) {
            $messageRes = $stmt->fetch(PDO::FETCH_OBJ);
            $res["message"] = $messageRes;

            // Also now remove that message
            $messageId = $messageRes->id;
            $stmt = $db->prepare('DELETE FROM queueMessages WHERE id=:id');
            $stmt->bindParam('id', $messageId);
            $stmt->execute();
        }
    }

    // Add the "stack" of resolved requests if an admin
    if (isUserLoggedIn()){
        $email = getUserEmail();

        if (isQueueAdmin($db, $email, $queueId)) {
            $stmt = $db->prepare('SELECT id, email, name, location, mapX, mapY, description, UNIX_TIMESTAMP(ts) as ts, UNIX_TIMESTAMP(tsRemoved) as tsRemoved, removedBy FROM stack WHERE queueId=:queueId ORDER BY tsRemoved DESC LIMIT 20');
            $stmt->bindParam('queueId', $queueId);
            $stmt->execute();

            $stackRes = $stmt->fetchAll(PDO::FETCH_OBJ);
            $res["stack"] = $stackRes;
        }
        
        // determine whether signing up is allowed
        $res['isSignUpProhibited'] = isSignUpProhibited($db, $email, $queueId);
    }

    // add the current schedule for today
    $res['schedule'] = getQueueScheduleToday($db, $queueId);
    $res['isOpen'] = isQueueOpen($db, $queueId);
    $res['halfHour'] = getCurrentHalfHour();

    // add any queue announcements
    $res['announcements'] = getQueueAnnouncements($db, $queueId);


    echo json_encode($res);
});

// GET request for list of courses
$app->get('/api/courseList', function () {

    $db = dbConnect();
    $stmt = $db->prepare('SELECT * FROM queueCourses ORDER BY courseId');
    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_OBJ);
    echo json_encode($res);
});


// GET request for list of queues
$app->get('/api/queueList/:courseId', function ($courseId) {

    $db = dbConnect();

    $stmt = $db->prepare('SELECT * FROM queues WHERE courseId=:courseId AND isActive=1 ORDER BY queueId');
    $stmt->bindParam('courseId', $courseId);

    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_OBJ);
    echo json_encode($res);
});



// GET request for full schedule for one queue
$app->get('/api/schedule/:queueId', function ($queueId) {

    // Ensure the queue exists - NOT NEEDED. let it fail if the request a bad one
    //assert(isQueue($db, $queueId));

    $db = dbConnect();

    $res = getQueueSchedule($db, $queueId);
    echo json_encode($res);
});



// POST request to set schedule for a queue
$app->post('/api/updateSchedule', function () use ($app){

    //$idtoken = $app->request->post('idtoken');
    $email = getUserEmail();

    $queueId = $app->request->post('queueId');

    $schedule = $app->request->post('schedule');
    for ($i = 0; $i < count($schedule); $i++) {
        $schedule[$i] = preg_replace("/[^a-z]+/", "", $schedule[$i]); // sanitize just in case
    }

    $db = dbConnect();

    // Must be an admin for the course
    if (!isQueueAdmin($db, $email, $queueId)) { $app->halt(403); return; };

    for ($i = 0; $i < count($schedule); $i++) {
        $daySchedule = $schedule[$i];
        $stmt = $db->prepare('UPDATE queueSchedule SET schedule=:schedule WHERE queueId=:queueId AND day=:day');
        $stmt->bindParam('queueId', $queueId);
        $stmt->bindParam('day', $i);
        $stmt->bindParam('schedule', $daySchedule);
        $stmt->execute();
    }
});

// GET request for queue roster (admins only)
$app->get('/api/roster/:queueId', function ($queueId) use ($app) {

    $email = getUserEmail();

    $db = dbConnect();

    // Must be an admin for the course
    if (!isQueueAdmin($db, $email, $queueId)) { $app->halt(403); return; };

    $stmt = $db->prepare('SELECT email FROM queueRoster WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);

    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_OBJ);
    echo json_encode($res);
});

// GET request for queue groups (admins only)
$app->get('/api/groups/:queueId', function ($queueId) use ($app) {

    $email = getUserEmail();

    $db = dbConnect();

    // Must be an admin for the course
    if (!isQueueAdmin($db, $email, $queueId)) { $app->halt(403); return; };

    $stmt = $db->prepare('SELECT email, teammateEmail FROM queueGroups WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);

    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_OBJ);
    echo json_encode($res);
});



// POST request to upload JSON file containing student groups
$app->post('/api/updateGroups', function () use ($app){

    $email = getUserEmail();

    $queueId = $app->request->post('queueId');

    $db = dbConnect();

    // Must be an admin for the course
    if (!isQueueAdmin($db, $email, $queueId)) { $app->halt(403); return; };

    $groupData = json_decode(file_get_contents($_FILES['upload']['tmp_name']), true);

    // TODO check for file errors

    // drop all group data for this course from DB
    $stmt = $db->prepare('DELETE FROM queueRoster WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);
    $stmt->execute();
    $stmt = $db->prepare('DELETE FROM queueGroups WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);
    $stmt->execute();

    $str = '';
    foreach ($groupData as &$group) {
        $members = $group['member_names'];
        for($i = 0; $i < count($members); ++$i) {
            $member = $members[$i];

            // Insert individual students into the roster
            $stmt = $db->prepare('INSERT INTO queueRoster values (:queueId, :member)');
            $stmt->bindParam('queueId', $queueId);
            $stmt->bindParam('member', $member);
            $stmt->execute();

            // Add students to groups
            for($k = 0; $k < count($members); ++$k) {
                if ($i != $k) {
                    $teammate = $members[$k];
                    $str = $str.''.$member.', '.$teammate.'\n';
                    // Add group to DB
                    $stmt = $db->prepare('INSERT INTO queueGroups values (:queueId, :member, :teammate)');
                    $stmt->bindParam('queueId', $queueId);
                    $stmt->bindParam('member', $member);
                    $stmt->bindParam('teammate', $teammate);
                    $stmt->execute();
                }
            }
        }
    }

    echo json_encode(array(
        'success'=>'success',
        'data'=> $str
    ));
});

// POST request to update queue configuration
$app->post('/api/updateQueueConfiguration', function () use ($app){

    $email = getUserEmail();

    $queueId = $app->request->post('queueId');

    // Get configuration options and sanitize them to only "y" or "n"
    $preventUnregistered = $app->request->post('preventUnregistered') === "y" ? "y" : "n";
    $preventGroups = $app->request->post('preventGroups') === "y" ? "y" : "n";
    $prioritizeNew = $app->request->post('prioritizeNew') === "y" ? "y" : "n";
    $preventGroupsBoost = $app->request->post('preventGroupsBoost') === "y" ? "y" : "n";

    $db = dbConnect();

    // Must be an admin for the course
    if (!isQueueAdmin($db, $email, $queueId)) { $app->halt(403); return; };

    // Update configuration options in database
    $query = 'UPDATE queueConfiguration set ';
    $query .= 'preventUnregistered=:preventUnregistered, ';
    $query .= 'preventGroups=:preventGroups, ';
    $query .= 'prioritizeNew=:prioritizeNew, ';
    $query .= 'preventGroupsBoost=:preventGroupsBoost ';
    $query .= 'where queueId=:queueId;';
    $stmt = $db->prepare($query);
    $stmt->bindParam('queueId', $queueId);
    $stmt->bindParam('preventUnregistered', $preventUnregistered);
    $stmt->bindParam('preventGroups', $preventGroups);
    $stmt->bindParam('prioritizeNew', $prioritizeNew);
    $stmt->bindParam('preventGroupsBoost', $preventGroupsBoost);
    $stmt->execute();

    echo json_encode(array(
        'success'=>'success'

    ));
});


// GET request for queue configuration
$app->get('/api/queueConfiguration/:queueId', function ($queueId) use ($app) {

    $email = getUserEmail();

    $db = dbConnect();

    // Must be an admin for the course
    if (!isQueueAdmin($db, $email, $queueId)) { $app->halt(403); return; };

    $stmt = $db->prepare('SELECT * FROM queueConfiguration WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);

    $stmt->execute();

    $res = $stmt->fetch(PDO::FETCH_OBJ);
    echo json_encode($res);
});



///// EXAM /////////////////////////////////////

// GET request for queue roster (admins only)
$app->get('/api/exam/:courseId', function ($courseId) use ($app) {

    $email = getUserEmail();

    $db = dbConnect();

    // Must be an admin for the course
    if (!isCourseAdmin($db, $email, $courseId)) { $app->halt(403); return; };

    $stmt = $db->prepare('SELECT email FROM queueRoster WHERE queueId=:queueId');
    $stmt->bindParam('queueId', $queueId);

    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_OBJ);
    echo json_encode($res);
});

// POST endpoint to add an announcement
$app->post('/api/announcements/', function () use ($app){

    // Retrieve and sanitize POST parameters
    $queueId = intval($app->request->post('queueId'));
    $content = htmlspecialchars($app->request->post('content'));

    $db = dbConnect();

    // Must be an admin for the course
    $email = getUserEmail();
    if (!isQueueAdmin($db, $email, $queueId)) {
        $app->halt(403);
        return;
    };

    $stmt = $db->prepare('INSERT INTO announcements (queueId, content) VALUES (:queueId, :content);');
    $stmt->bindParam('queueId', $queueId);
    $stmt->bindParam('content', $content);
    $stmt->execute();
});

// DELETE endpoint to remove an announcement
$app->delete('/api/announcements/:id', function ($id) use ($app){

    $db = dbConnect();

    $stmt = $db->prepare('SELECT queueId from announcements where id=:id');
    $stmt->bindParam('id', $id);
    $stmt->execute();

    if ($stmt->rowCount() == 0) {
        return;
    }
    $res = $stmt->fetch(PDO::FETCH_OBJ);
    $queueId = $res->queueId;

    // Must be an admin for the course
    $email = getUserEmail();
    if (!isQueueAdmin($db, $email, $queueId)) {
        $app->halt(403);
        return;
    };

    $stmt = $db->prepare('DELETE FROM announcements where id=:id');
    $stmt->bindParam('id', $id);
    $stmt->execute();
});

$app->get('/api/stack/:queueId', function ($queueId) use ($app) {
    $db = dbConnect();

    if (!isUserLoggedIn()) {
        $app->halt(403);
        return;
    }

    $email = getUserEmail();    
    if (!isQueueAdmin($db, $email, $queueId)) {
        $app->halt(403);
        return;
    }

    $stmt = $db->prepare('SELECT id, email, name, location, mapX, mapY, description, UNIX_TIMESTAMP(ts) as ts, UNIX_TIMESTAMP(tsRemoved) as tsRemoved, removedBy FROM stack WHERE queueId=:queueId ORDER BY tsRemoved DESC LIMIT 10000');
    $stmt->bindParam('queueId', $queueId);
    $stmt->execute();

    $stackRes = $stmt->fetchAll(PDO::FETCH_OBJ);
    echo json_encode($stackRes);
});

function buildQueueAppointmentsQuery($queueId, $isAdmin, $daysFromToday) {

    $daysFromToday = intval($daysFromToday);

    $query = 'SELECT id, queueId, studentEmail, startTime, duration';
    if ($isAdmin) {
        $query .= ', staffEmail';
    }

    $today = $daysFromToday;
    $tomorrow = $daysFromToday+1;
    // select entries on the given day (i.e. today if daysFromToday is 0)
    $query .= ' FROM appointments WHERE queueId=:queueId AND startTime >= (CURDATE()+'.$today.') AND startTime < (CURDATE()+'.$tomorrow.');';

    return $query;
}

// GET all appointments for a particular queue for today
$app->get('/api/queues/:queueId/appointments/:daysFromToday', function ($queueId, $daysFromToday) {

    $queueId = intval($queueId);
    $daysFromToday = intval($daysFromToday);

    $db = dbConnect();

    $isAdmin = false;

    if (isUserLoggedIn()) {
        $email = getUserEmail();
        $isAdmin = isQueueAdmin($db, $email, $queueId);
    }
    
    $stmt = $db->prepare(buildQueueAppointmentsQuery($queueId, $isAdmin, $daysFromToday));
    $stmt->bindParam('queueId', $queueId);
    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($res);
});

// GET appointments schedule for a particular queue
$app->get('/api/queues/:queueId/appointmentsSchedule', function ($queueId) {

    $queueId = intval($queueId);

    $db = dbConnect();
    
    $stmt = $db->prepare('SELECT queueId, day, duration, padding, schedule from appointmentsSchedule WHERE queueId=:queueId ORDER BY day ASC');
    $stmt->bindParam('queueId', $queueId);
    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($res);
});

$app->run();

?>
