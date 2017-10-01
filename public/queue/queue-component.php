<?php

require_once 'vendor/autoload.php';

$GLOBALS["config"] = parse_ini_file("../../php/queue/php.config");

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

//echo($app->request->getPathInfo());
//exit();

$app->get('/queue-component/courseContent/eecs280', function(){
?>
  <h3> Welcome to EECS 280 Office Hours! </h3>
  <!-- <img src="1695BBB.jpg" width="400px"/> -->
    <!-- <h3>Office hours have been pretty busy lately…</h3>
    <p>We will help you as much as we are able, but we may only be able
       to spend a short amount of time with each student (e.g. 5 minutes)
       to ensure we are able to get to everyone in a timely fashion. We may
       not always find your bug in this time, but we will leave you with
       some next steps to take to track it down on your own.</p> -->
<!--    <h3>Before asking a question at office hours…</h3>
   <ol>
       <li>
       Do a search on piazza for your problem and or question
       </li>
       <li>
           If it’s a coding question, narrow down where in your code your program is going wrong
           <ul>
               <li>
                   If you are using a debugger like­­ Xcode or visual studio, set breakpoints
               </li>
               <li>
                   Else use print statements
               </li>
           </ul>
       </li>
       <li>
           If you did step 1 and 2 and are still stuck OR have a question about how to do step 1 or 2 please feel free to ask us, we are here to help
       </li>
   </ol> -->
   <p><a class="adminOnly" href="https://docs.google.com/document/d/1ujhe_pKSgeUS4K3nl9PKx1R6RVT1r5wKx_USEtL5pn4/edit" target="_blank">OHFAQ</a></p>
   <!-- <p><a class="adminOnly" href="https://goo.gl/forms/UYAlhr5Dt2pz7TA03" target="_blank">Alex's Independent Study Form</a></p> -->

<?php

});



$app->get('/queue-component/courseContent/engr101', function(){
?>
    <h4>Welcome to ENGR101 Office Hours!</h4>

<?php

});

$app->get('/queue-component/courseContent/:courseId', function($courseId){
    echo "<p>Welcome to the help queue for $courseId!</p>";
});

$app->run();

?>
