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




// POST request to add a writing sequence for a queue
$app->post('/escape-api/addWritingSequence', function () use ($app){

    $roomId = intval($app->request->post('roomId'));

    $sequence = $app->request->post('sequence');

    $db = dbConnect();

    $stmt = $db->prepare('INSERT INTO escape values (NULL, :roomId, :sequence)');
    $stmt->bindParam('roomId', $roomId);
    $stmt->bindParam('sequence', $sequence);
    $stmt->execute();
});


// GET request for most recent writing sequence
$app->get('/escape-api/getNewWritingSequences/:roomId', function ($roomId) {

    $db = dbConnect();

    $stmt = $db->prepare('SELECT * FROM escape WHERE roomId=:roomId ORDER BY id');
    $stmt->bindParam('roomId', $roomId);
    $stmt->execute();

    $res = $stmt->fetchAll(PDO::FETCH_OBJ);
    echo json_encode($res);

    $stmt = $db->prepare('DELETE FROM escape WHERE roomId=:roomId');
    $stmt->bindParam('roomId', $roomId);
    $stmt->execute();
});

$app->run();

?>
