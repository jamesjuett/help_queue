<?php

require_once 'vendor/autoload.php';

$GLOBALS["config"] = parse_ini_file("../../php/php.config");

require_once '../../php/auth.php';

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

    // Ensure the user is not already signed up (admins excluded)
    if (!isQueueAdmin($db, $email, $queueId)) {
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



    $stmt = $db->prepare('INSERT INTO queue values (NULL, :email, :queueId, :name, :location, :mapX, :mapY, :description, NULL)');

    $stmt->bindParam('email', $email);
    $stmt->bindParam('queueId', $queueId);
    $stmt->bindParam('name', $name);
    $stmt->bindParam('location', $location);
    $stmt->bindParam('mapX', $mapX);
    $stmt->bindParam('mapY', $mapY);
    $stmt->bindParam('description', $description);

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
    $stmt->bindParam('name', $name);
    $stmt->bindParam('location', $location);
    $stmt->bindParam('mapX', $mapX);
    $stmt->bindParam('mapY', $mapY);
    $stmt->bindParam('description', $description);
    $stmt->execute();
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

        $stmt = $db->prepare('INSERT INTO stack SELECT *, NULL, :remover from queue where id=:id');
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

function getQueueList($db, $queueId) {
    if (isUserLoggedIn()){
        $email = getUserEmail();

        if (isQueueAdmin($db, $email, $queueId)) {
            $stmt = $db->prepare('SELECT id, email, name, location, mapX, mapY, description, UNIX_TIMESTAMP(ts) as ts FROM queue WHERE queueId=:queueId ORDER BY ts');
            $stmt->bindParam('queueId', $queueId);
            $stmt->execute();

            $res = $stmt->fetchAll(PDO::FETCH_OBJ);
            return $res;
        }
    }

    $stmt = $db->prepare('SELECT id, UNIX_TIMESTAMP(ts) as ts FROM queue WHERE queueId=:queueId ORDER BY ts');
    $stmt->bindParam('queueId', $queueId);
    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (isUserLoggedIn()){
        $email = getUserEmail();

        // Add additional information for themselves
        $stmt = $db->prepare('SELECT id, email, name, location, description, UNIX_TIMESTAMP(ts) as ts FROM queue WHERE queueId=:queueId AND email=:email');
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
                    $res[$i]['description'] = $individual['description'];
                }
            }
        }

    }

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

    if (isUserLoggedIn()){
        $email = getUserEmail();

        if (isQueueAdmin($db, $email, $queueId)) {
            $stmt = $db->prepare('SELECT id, email, name, location, mapX, mapY, description, UNIX_TIMESTAMP(ts) as ts, UNIX_TIMESTAMP(tsRemoved) as tsRemoved, removedBy FROM stack WHERE queueId=:queueId ORDER BY tsRemoved DESC LIMIT 20');
            $stmt->bindParam('queueId', $queueId);
            $stmt->execute();

            $stackRes = $stmt->fetchAll(PDO::FETCH_OBJ);
            $res["stack"] = $stackRes;
        }
    }

    // add the current schedule for today
    $res["schedule"] = getQueueScheduleToday($db, $queueId);
    $res["isOpen"] = isQueueOpen($db, $queueId);
    $res["halfHour"] = getCurrentHalfHour();


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

    $stmt = $db->prepare('SELECT * FROM queues WHERE courseId=:courseId ORDER BY queueId');
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

$app->run();

?>
