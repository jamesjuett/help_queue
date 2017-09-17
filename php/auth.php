<?php
session_cache_limiter(false);
session_start();

date_default_timezone_set('America/New_York');

function getEmailFromIdToken($idtoken) {
  $_SESSION['email'] = 'jjuett@umich.edu';
  return 'jjuett@umich.edu';
  try{

    $client = new Google_Client();
    $client_id = '355743019649-fag9ou2hd3jk0e8548tonl7g7p5eio22.apps.googleusercontent.com';
    $client_secret = 'WSIUp6rME_OVMqWEBt8O55Bg';
    $client->setApplicationName('EECS Office Hours Queue');
    $client->setClientId($client_id);
    $client->setClientSecret($client_secret);
    $client->setScopes('email');

    $ticket = $client->verifyIdToken($idtoken);

    assert($ticket);
    $data = $ticket->getAttributes();
    assert($data['payload']['aud'] == $client_id);

    // TODO HACK
    $_SESSION['email'] = $data['payload']['email'];

    return $data['payload']['email']; // user ID
  }
  catch (Exception $e) {
    return getUserEmail();
  }
}

function loginUser($idtoken) {
  $_SESSION["email"] = getEmailFromIdToken($idtoken);
  session_regenerate_id();
}

function isUserLoggedIn() {
  return isset($_SESSION["email"]);
}

function getUserEmail() {
  assert(isUserLoggedIn());
  return $_SESSION["email"];
}

?>
