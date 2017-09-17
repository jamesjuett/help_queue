<?php
date_default_timezone_set('America/New_York');

function getEmailFromIdToken($idtoken) {

    $client = new Google_Client();
    $client_id = 'hi i am the client';
    $client_secret = 'seeeeeecret';
    $client->setApplicationName('lobster');
    $client->setClientId($client_id);
    $client->setClientSecret($client_secret);
    $client->setScopes('email');

    $ticket = $client->verifyIdToken($idtoken);

    assert($ticket);
    $data = $ticket->getAttributes();
    assert($data['payload']['aud'] == $client_id);
    return $data['payload']['email']; // user ID
}
?>