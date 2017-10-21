/**
 * Created by James Juett on 9/5/2016.
 */

var ANIMATION_DELAY = 500;

var QueueApplication = Singleton(Class.extend({
    _name: "QueueApplication",

    init : function(elem) {
        this.i_elem = elem;

        this.i_coursePills = elem.find(".coursePills");
        this.i_coursePanes = elem.find(".coursePanes");

        this.i_courses = [];

        this.i_messagesShown = {};

        this.loadCourses();
    },

    loadCourses : function() {
        return this.ajax({
            type: "GET",
            url: "api/courseList",
            dataType: "json",
            success: this.onCoursesLoad,
            error: oops
        });
    },

    onCoursesLoad : function(list){
        this.i_coursePills.empty();
        this.i_coursePanes.empty();
        this.i_courses.clear();


        // No active course initially
        this.i_coursePanes.append($('<div class="tab-pane fade in active"><h1><span class="glyphicon glyphicon-arrow-left"></span> Please select a course.</h1></div>'));

        var self = this;
        list.forEach(function(courseData){

            // Escape everything
            // TODO redundant - this happens on the server
            for (var key in courseData){
                courseData[key] = escapeHtml(courseData[key]);
            }

            var courseId = courseData["courseId"];

            // Add the pill used to select the course
            var pillElem = $('<li><a href="#' + courseId + '" data-toggle="pill"><h3>' + courseId + '</h3></a></li>');
            self.i_coursePills.append(pillElem);

            // Add the element that will contain the course content
            var courseElem = $('<div id="' + courseId + '" class="tab-pane fade"></div>');
            self.i_coursePanes.append(courseElem);

            // Create the course itself
            var course = Course.instance(courseData, courseElem);
            self.i_courses.push(course);

            pillElem.find("a").click(function(){
                course.makeActive();
            });
        });
    },

    setActiveQueue : function(queue) {
        this.i_activeQueue = queue;
        console.log("Setting active queue to " + queue.i_queueId);
        queue.madeActive();
        this.updateSignUpForm();
    },

    activeQueue : function(){
        return this.i_activeQueue;
    },

    updateSignUpForm : function() {
        if (this.i_activeQueue.hasMap()) {
            $("#signUpMapHolder").show();
            $("#signUpMapMessage").show();
            $("#signUpMapImage").attr("src", this.i_activeQueue.mapImageSrc());
        }
        else {
            $("#signUpMapHolder").hide();
            $("#signUpMapMessage").hide();
        }
    },

    userSignedIn : function() {
        this.i_courses.forEach(function(course){
            course.userSignedIn();
        });
    },

    refreshActiveQueue : function() {
        this.i_activeQueue && this.i_activeQueue.refresh();
        this.refreshContent();
    },

    message : function(message) {
        if (!this.i_messagesShown[message.id]){
            this.i_messagesShown[message.id] = true;
            $("#messageDialogHeader").html('Message');
            $("#messageDialogContent").append('<p><span class="label label-info">'  + message["sender"] + '</span> ' + message["message"] + '</p>');
            $("#messageDialog").modal("show");
        }
    },

    setSendMessagePostId : function(id) {
        this.i_sendMessagePostId = id;
    },

    sendMessage : function(message) {
        this.ajax({
            type: "POST",
            url: "api/sendMessage",
            data: {
                idtoken: User.idToken(),
                id: this.i_sendMessagePostId,
                message: message
            },
            success: function(){
            },
            error: oops
        });
    },

    refreshContent : function() {
        if (this.i_activeQueue) {
            document.title = this.i_activeQueue.course().shortName() + " OH (" + this.i_activeQueue.numEntries() + ")";
        }
    },

    notify : function(title, message){
      if (!Notification) {
        alert(message);
      }
      else {
        if (Notification.permission !== "granted") {
          Notification.requestPermission();
        }
        else {
          new Notification(title, {
            body: message
          });
        }
      }
    }
}));


var Course = Class.extend({
    _name: "Course",

    init : function(data, elem) {

        this.i_courseId = data["courseId"];
        this.i_shortName = data["shortName"];
        this.i_fullName = data["fullName"];
        this.i_elem = elem;
        this.i_isAdmin = false;

        this.i_queues = [];

        this.i_elem.addClass(User.isCourseAdmin(this.i_courseId));

        this.i_queuePillsElem = $('<ul class="queuePills nav nav-pills"></ul>');
        this.i_elem.append(this.i_queuePillsElem);

        this.i_pickAQueueElem = $('<div></div>');
        this.i_pickAQueueElem.append($('<h3><span class="glyphicon glyphicon-arrow-up"></span> Several locations are available for ' + this.i_shortName + '. Please select one.</h3>'));
        this.i_elem.append(this.i_pickAQueueElem);

        this.i_mainElem = $('<div></div>');
        this.i_mainElem.hide();

        this.i_queuePanesElem = $('<div class="col-xs-12 col-md-12 queuePanes tab-content"></div>');
        this.i_mainElem.append(this.i_queuePanesElem);

        this.i_contentElem = $('<div class="col-xs-12 col-md-12"></div>');
        this.i_mainElem.append(this.i_contentElem);

        this.i_elem.append(this.i_mainElem);

        this.loadContent();
        this.loadQueues();
    },

    shortName : function() {
        return this.i_shortName;
    },

    makeActive : function() {
        // Don't need to do anything in particular for the course itself,
        // but we do need to make sure the active queue within this course
        // is the active queue overall since it will be shown.
        this.i_activeQueue && this.i_activeQueue.makeActive();
    },

    loadContent : function() {
        this.i_contentElem.load("queue-component/courseContent/" + this.i_courseId);
    },

    loadQueues : function() {
        return this.ajax({
            type: "GET",
            url: "api/queueList/" + this.i_courseId,
            dataType: "json",
            success: this.i_onQueuesLoad,
            error: oops
        });
    },

    i_onQueuesLoad : function(list){
        this.i_queues.clear();
        this.i_queuePillsElem.empty();
        this.i_queuePanesElem.empty();

        var self = this;
        list.forEach(function(item){
            var name = item["name"];
            var queueId = item["queueId"];

            // Add pills for each queue belonging to this course
            var pillElem = $('<li><a data-toggle="pill"><h6>' + name + '</h6></a></li>');
            pillElem.find("a").prop("href", "#queue" + queueId);
            self.i_queuePillsElem.append(pillElem);

            // Add panes to hold the queue
            var queueElem = $('<div id="queue' + queueId + '"></div>');
            queueElem.addClass("tab-pane fade");
            self.i_queuePanesElem.append(queueElem);

            // Create the queue objects themselves
            var queue = Queue.instance(item, self, queueElem);
            self.i_queues.push(queue);

            queue.refresh();

            pillElem.find("a").click(function(){
                self.i_pickAQueueElem.empty();
                self.i_activeQueue = queue;
                self.i_mainElem.show();
                queue.makeActive();
            });
        });


        // If only one queue, select it automatically
        // (pillElem and queueElem are still in scope even after the loop body)
        if (this.i_queues.length === 1) {
            this.i_queuePillsElem.children().first().addClass("active");
            this.i_queuePanesElem.children().first().addClass("in active");
            this.i_activeQueue = this.i_queues[0];
            this.i_pickAQueueElem.hide();
            this.i_mainElem.show();
        }
        else{
            this.i_pickAQueueElem.show();
            this.i_mainElem.hide();
        }

        this.setAdmin(User.isCourseAdmin(this.i_courseId));
    },

    setAdmin : function(isAdmin){
        this.i_isAdmin = isAdmin;
        for(var i = 0; i < this.i_queues.length; ++i) {
            this.i_queues[i].setAdmin(isAdmin)
        }
        if (this.i_isAdmin) {
            this.i_elem.addClass("admin");
            this.i_elem.removeClass("notAdmin");
        }
        else{
            this.i_elem.addClass("notAdmin");
            this.i_elem.removeClass("admin");
        }
    },

    userSignedIn : function(){
        this.setAdmin(User.isCourseAdmin(this.i_courseId));
        this.i_queues.forEach(function(queue){
            queue.userSignedIn();
        });
    },

    updatePartnerships : function(formData) {

        $.ajax({
            type: "POST",
            url: "api/updatePartnerships",
            cache: false,
            contentType: false,
            processData: false,
            data: formData,
            // dataType: "json",
            success: function(data){
            //     // if another refresh has been requested, ignore the results of this one
            //     if (myRefreshIndex === self.i_currentRefreshIndex){
            //         self.refreshResponse(data);
            //     }
            },
            error: oops
        });

    }

});



var Queue = Class.extend(Observable, {
    _name: "Queue",

    init : function(data, course, elem) {

        this.i_course = course;

        this.i_queueId = data["queueId"];
        this.i_location = data["location"];
        this.i_mapImgSrc = data["map"];
        this.i_name = data["name"];
        this.i_elem = elem;

        this.i_isAdmin = false;
        this.i_numEntries = 0;
        this.i_currentRefreshIndex = 0;
        this.i_lastRefresh = new Date();
        this.i_isOpen = false;
        this.i_refreshDisabled = false;

        var statusElem = $('<p></p>').appendTo(this.i_elem);
        statusElem.append(
            $('<span data-toggle="tooltip" title="Number of Students"><span class="glyphicon glyphicon-education"></span></span>')
                .append(" ")
                .append(this.i_numEntriesElem = $('<span></span>'))
        );
        statusElem.append('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
        statusElem.append(
            $('<span data-toggle="tooltip" title="Last Refresh"><span class="glyphicon glyphicon-refresh"></span></span>')
                .append(" ")
                .append(this.i_lastRefreshElem = $('<span></span>'))
        );
        statusElem.append('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');

        this.i_statusMessageElem = $('<span>Loading queue information...</span>');
        statusElem.append(this.i_statusMessageElem);

        this.i_adminStatusElem = $('<span class="adminOnly"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;You are an admin for this queue.</b></span>');
        statusElem.append(this.i_adminStatusElem);


        this.i_adminControlsElem = $('<div class="panel panel-default adminOnly"><div class="panel-body"></div></div>')
            .appendTo(this.i_elem)
            .find(".panel-body");

        this.i_adminControls = AdminControls.instance(this, this.i_adminControlsElem);
        this.addListener(this.i_adminControls);

        this.i_studentControlsElem = $('<div class="panel panel-default"><div class="panel-body"></div></div>')
            .appendTo(this.i_elem)
            .find(".panel-body");

        this.i_studentControls = StudentControls.instance(this, this.i_studentControlsElem);
        this.addListener(this.i_studentControls);

        // if (this.hasMap()) {
        //     this.i_adminControlsElem.append('<p class="adminOnly">Click the "Locate" button on a student\'s request to update the map.</p>');
        //     var mapHolder = $('<div style="position: relative; margin-top: 10px;"></div>');
        //     this.i_mapElem = $('<img class="adminOnly queue-staffMap" src="img/' + this.mapImageSrc() + '"></img>');
        //     mapHolder.append(this.i_mapElem);
        //     this.i_mapPin = $('<span class="adminOnly queue-locatePin"><span class="glyphicon glyphicon-map-marker" style="position:absolute; left:-1.3ch;top:-0.95em;"></span></span>');
        //     mapHolder.append(this.i_mapPin);
        //     this.i_adminControlsElem.append(mapHolder);
        // }

        this.i_queueElem = $('<div></div>').appendTo(this.i_elem);
	    this.i_stackElem = $('<div class="adminOnly"></div>').appendTo(this.i_elem);

        this.i_elem.find('[data-toggle="tooltip"]').tooltip();

        this.userSignedIn(); // TODO change name to updateUser?
    },

    makeActiveOnClick : function(elem) {
        var self = this;
        elem.click(function(){
            self.makeActive();
        });
    },

    makeActive : function() {
        QueueApplication.setActiveQueue(this);
        this.refresh();
    },

    // Callback when a queue becomes active
    madeActive : function() {

    },

    refresh : function() {

        // myRefreshIndex is captured in a closure with the callback.
        // if refresh had been called again, the index won't match and
        // we don't do anything. this prevents the situation where someone
        // signs up but then a pending request from before they did so finishes
        // and causes it to look like they were immediately removed. this also
        // fixes a similar problem when an admin removes someone but then a
        // pending refresh makes them pop back up temporarily.
        this.i_currentRefreshIndex += 1;
        var myRefreshIndex = this.i_currentRefreshIndex;

        var self = this;
        return $.ajax({
            type: "POST",
            url: "api/list",
            data: {
                queueId: self.i_queueId
            },
            dataType: "json",
            success: function(data){
                // if another refresh has been requested, ignore the results of this one
                if (myRefreshIndex === self.i_currentRefreshIndex){
                    self.refreshResponse(data);
                }
            },
            error: oops
        });
    },

    refreshResponse : function(data){

        if (this.i_refreshDisabled) {
          return;
        }

        if (data["message"]) {
            QueueApplication.message(data["message"]);
        }

        var isOpen = data["isOpen"];
        this.i_isOpen = isOpen;
        if (isOpen) {
            this.i_statusMessageElem.html("The queue is open.");
        }
        else {
            var schedule = data["schedule"];
            var halfHour = data["halfHour"];
            var nextOpen = -1;
            for(var i = halfHour; i < 48; ++i) {
                var scheduleType = schedule.charAt(i);
                if (scheduleType === "o" || scheduleType === "p") {
                    nextOpen = i;
                    break;
                }
            }

            if (nextOpen === -1) {
                this.i_statusMessageElem.html("The queue is closed for today.");
            }
            else {
                var d = new Date();
                d.setHours(0);
                d.setMinutes(0);
                d.setSeconds(0);

                var newDate = new Date(d.getTime() + nextOpen*30*60000);
                this.i_statusMessageElem.html("The queue is closed right now. It will open at " + newDate.toLocaleTimeString() + ".");
            }


        }


        var queue = data["queue"];
        this.i_queueElem.empty();
        var queueEntries = [];
        var myRequest = null;
        for(var i = 0; i < queue.length; ++i) {
            var item = queue[i];

            var itemElem = $("<li class='list-group-item'></li>");
            var entry = QueueEntry.instance(this, item, itemElem);
            queueEntries.push(entry);

            if (!myRequest && User.isMe(entry.email())) {
                myRequest = entry;
            }

            this.i_queueElem.append(itemElem);

        }
        this.i_setMyRequest(myRequest);


        this.send("queueRefreshed");

        // console.log(JSON.stringify(data["stack"], null, 4));
        this.i_stackElem.html("<h3>The Stack</h3><br /><p>Most recently removed at top</p><pre>" + JSON.stringify(data["stack"], null, 4) + "</pre>");


        var oldNumEntries = this.i_numEntries;
        this.i_numEntries = queue.length;
        if(this.i_isAdmin && oldNumEntries === 0 && this.i_numEntries > 0) {
          QueueApplication.notify("Request Received!", queueEntries[0].name());
        }

        this.i_lastRefresh = new Date();


        this.i_numEntriesElem.html(this.numEntries());
        this.i_lastRefreshElem.html(this.lastRefresh().toLocaleTimeString());
    },

    i_setMyRequest : function(myRequest) {
        this.i_myRequest = myRequest;
        this.send("myRequestSet");
    },

    removeRequest : function(request) {
        console.log("attempting to remove " + request.email() + " from queue " + this.queueId());
        this.disableRefresh();
        var self = this;
        $.ajax({
            type: "POST",
            url: "api/remove",
            data: {
                id: request.requestId()
            },
            success : function() {
                console.log("successfully removed " + request.email() + " from queue " + self.queueId());
                request.onRemove();
            },
            error: oops
        }).always(function(){
            setTimeout(function(){
                self.enableRefresh();
                self.refresh();
            }, ANIMATION_DELAY)
        });
    },

    numEntries : function() {
        return this.i_numEntries;
    },

    lastRefresh : function() {
        return this.i_lastRefresh;
    },

    cancelIncomingRefresh : function () {
      this.i_currentRefreshIndex += 1;
    },

    disableRefresh : function() {
      this.i_refreshDisabled = true;
    },

    enableRefresh : function() {
      this.i_refreshDisabled = false;
    },

    clear : function() {
        return this.ajax({
            type: "POST",
            url: "api/clear",
            data: {
                idtoken: User.idToken(),
                queueId: this.i_queueId
            },
            success: this.clearList,
            error: oops
        });
    },

    clearList : function() {
        this.i_queueElem.children().slideUp();
    },

    signUp : function(name, location, mapX, mapY, description) {
        return this.ajax({
            type: "POST",
            url: "api/signUp",
            data: {
                idtoken: User.idToken(),
                queueId: this.i_queueId,
                name: name,
                location: location,
                mapX: mapX,
                mapY: mapY,
                description: description
            },
            dataType: "json",
            success: function(data){
                if (data["fail"]) {
                    showErrorMessage(data["reason"]);
                }
                else {
                    this.refresh();
                }
            },
            error: oops
        });
    },

    updateRequest : function(name, location, mapX, mapY, description) {
        return this.ajax({
            type: "POST",
            url: "api/updateRequest",
            data: {
                id: this.myRequest().requestId(),
                name: name,
                location: location,
                mapX: mapX,
                mapY: mapY,
                description: description
            },
            dataType: "json",
            success: function(data){
                if (data["fail"]) {
                    showErrorMessage(data["reason"]);
                }
                else {
                    this.refresh();
                }
            },
            error: oops
        });
    },

    setAdmin : function(isAdmin) {
        var oldAdmin = this.i_isAdmin;
        this.i_isAdmin = isAdmin;

        // If our privileges change, hit the server for appropriate data,
        // because it gives out different things for normal vs. admin
        if (oldAdmin != this.i_isAdmin) {
            this.refresh();
        }
    },

    isAdmin : function() {
        return this.i_isAdmin;
    },

    userSignedIn : function() {
        this.send("userSignedIn");
    },

    isOpen : function() { return this.i_isOpen; },

    myRequest : function() { return this.i_myRequest; },

    hasRequest : function() { return !!this.i_myRequest; },

    course : function() {
        return this.i_course;
    },

    queueId : function() {
        return this.i_queueId;
    },

    hasMap : function() {
        return this.i_mapImgSrc !== "";
    },

    mapImageSrc : function() {
        return this.i_mapImgSrc;
    },

    locateOnMap : function(mapX, mapY) {
        var map = this.i_mapElem;
        var pin = this.i_mapPin;
        // var pinLeft = Math.floor(mapX * map.width());// - pin.width()/2);
        // var pinTop = Math.floor(mapY * map.height());// - pin.height());
        pin.css("left", mapX + "%");
        pin.css("top", mapY + "%");
    }


});

var StudentControls = Class.extend(Observer, {
    _name : "StudentControls",

    UPDATE_REQUEST_BUTTON_UP_TO_DATE : "<span class='glyphicon glyphicon-ok'></span> Request Updated",
    UPDATE_REQUEST_BUTTON_UPDATE : "Update Request",

    init : function(queue, elem) {
        var self = this;
        this.i_queue = queue;
        this.i_elem = elem;

        this.i_formHasChanges = false;

        var containerElem = $('<div></div>');

        var regularFormElem;
        var signUpNameInput;
        var signUpDescriptionInput;
        var signUpLocationInput;
        this.i_signUpForm = $('<form id="signUpForm" role="form" class="form-horizontal"></form>')
            .append(regularFormElem = $('<div></div>')
                .append($('<div class="form-group"></div>')
                    .append('<label class="control-label col-sm-3" for="signUpName' + queue.queueId() + '">Name:</label>')
                    .append($('<div class="col-sm-9"></div>')
                        .append(signUpNameInput = this.i_signUpNameInput = $('<input type="text" class="form-control" id="signUpName' + queue.queueId() + '" required="required" maxlength="30" placeholder="Nice to meet you!">'))
                    )
                )
                .append($('<div class="form-group"></div>')
                    .append('<label class="control-label col-sm-3" for="signUpDescription' + queue.queueId() + '">Description:</label>')
                    .append($('<div class="col-sm-9"></div>')
                        .append(signUpDescriptionInput = this.i_signUpDescriptionInput = $('<input type="text" class="form-control" id="signUpDescription' + queue.queueId() + '"required="required" maxlength="100" placeholder="e.g. Segfault in function X, using the map data structure, etc.">'))
                    )
                )
                .append($('<div class="form-group"></div>')
                    .append('<label class="control-label col-sm-3" for="signUpLocation' + queue.queueId() + '">Location:</label>')
                    .append($('<div class="col-sm-9"></div>')
                        .append(signUpLocationInput = this.i_signUpLocationInput = $('<input type="text" class="form-control" id="signUpLocation' + queue.queueId() + '"required="required" maxlength="30" placeholder="e.g. Computer #36, laptop by glass/atrium door, etc.">'))
                    )
                )
                .append('<div class="hidden-xs form-group"><div class="col-sm-offset-3 col-sm-9"><button type="submit" class="btn btn-success queue-signUpButton">Sign Up</button> <button type="submit" class="btn btn-success queue-updateRequestButton" style="display:none;"></button></div></div>')
            );

        containerElem.append(this.i_signUpForm);

        this.i_signUpForm.find("input").on("input", function() {
            self.formChanged();
        });


        if (this.i_queue.hasMap()) {
            regularFormElem.addClass("col-xs-12 col-sm-8");
            regularFormElem.css("padding", "0");
            this.i_signUpForm.append(this.i_mapHolder = $('<div class="col-xs-12 col-sm-4" style="position: relative; padding:0"></div>')
                .append(this.i_signUpMap = $('<img src="img/dude_basement.png" class="queue-signUpMap" style="width:100%"></img>'))
                .append(this.i_signUpPin = $('<span class="queue-locatePin"><span class="glyphicon glyphicon-map-marker" style="position:absolute; left:-1.3ch;top:-0.95em;"></span></span>'))
            );

            // Add different layout for sign up button on small screens
            this.i_signUpForm.append($('<div class="visible-xs col-xs-12" style="padding: 0;"><div class="form-group"><div class="col-sm-offset-3 col-sm-9"><button type="submit" class="btn btn-success queue-signUpButton">Sign Up</button> <button type="submit" class="btn btn-success queue-updateRequestButton" style="display:none;"></button></div></div></div>'));

            var pin = this.i_signUpPin;
            this.i_mapX = 50;
            this.i_mapY = 50;
            this.i_signUpMap.click(function (e) { //Offset mouse Position
                self.i_mapX = 100 * Math.trunc((e.pageX - $(this).offset().left)) / $(this).width();
                self.i_mapY = 100 * Math.trunc(e.pageY - $(this).offset().top) / $(this).height();
                // var pinLeft = mapX - pin.width()/2;
                // var pinTop = mapY - pin.height();
                pin.css("left", self.i_mapX + "%");
                pin.css("top", self.i_mapY + "%");
                self.formChanged();
//            alert("x:" + mapX + ", y:" + mapY);
            });

            // Disable regular location input
            signUpLocationInput.val("Click on the map!");
            signUpLocationInput.attr("disabled", true);
        }

        var self = this;
        this.i_signUpForm.submit(function(e){
            e.preventDefault();
            var signUpName = signUpNameInput.val();
            var signUpDescription = signUpDescriptionInput.val();
            var signUpLocation = signUpLocationInput.val();

            if (!signUpName || signUpName.length == 0 ||
                !signUpLocation || signUpLocation.length == 0 ||
                !signUpDescription || signUpDescription.length == 0){
                showErrorMessage("You must fill in all the fields.");
                return false;
            }

            var map = self.i_signUpMap;

            if (!self.i_queue.hasRequest()) {
                self.i_queue.signUp(
                    signUpName,
                    signUpLocation,
                    self.i_mapX,
                    self.i_mapY,
                    signUpDescription);
            }
            else {
                self.i_queue.updateRequest(
                    signUpName,
                    signUpLocation,
                    self.i_mapX,
                    self.i_mapY,
                    signUpDescription);
            }


            self.i_formHasChanges = false;
            self.i_updateRequestButtons.removeClass("btn-warning");
            self.i_updateRequestButtons.addClass("btn-success");
            self.i_updateRequestButtons.attr("disabled", true);
            self.i_updateRequestButtons.html(self.UPDATE_REQUEST_BUTTON_UP_TO_DATE);
            return false;
        });

        this.i_signUpButtons = this.i_signUpForm.find("button.queue-signUpButton");
        this.i_updateRequestButtons = this.i_signUpForm.find("button.queue-updateRequestButton")
            .attr("disabled", true).html(this.UPDATE_REQUEST_BUTTON_UP_TO_DATE);

        this.i_elem.append(containerElem);
    },

    formChanged : function() {
        if (this.i_queue.myRequest()) {
            this.i_formHasChanges = true;
            this.i_updateRequestButtons.removeClass("btn-success");
            this.i_updateRequestButtons.addClass("btn-warning");
            this.i_updateRequestButtons.attr("disabled", false);
            this.i_updateRequestButtons.html(this.UPDATE_REQUEST_BUTTON_UPDATE);
        }
    },

    refreshSignInEnabled : function() {
        var isEnabled = User.isUmich() && this.i_queue.isOpen() && !this.i_queue.myRequest();
        this.i_signUpButtons.attr("disabled", !isEnabled);

        if (this.i_queue.myRequest()) {
            this.i_updateRequestButtons.show();
        }
    },

    i_queueRefreshed : function() {
        this.refreshSignInEnabled();
    },

    i_userSignedIn : function() {
        this.refreshSignInEnabled();
    },

    _act : {
        queueRefreshed : "i_queueRefreshed",
        userSignedIn : "i_userSignedIn",
        myRequestSet : function() {
            var req = this.i_queue.myRequest();
            if (req && !this.i_formHasChanges) {
                this.i_signUpNameInput.val(req.name());
                this.i_signUpDescriptionInput.val(req.description());
                this.i_signUpLocationInput.val(req.location());
                if (this.i_queue.hasMap()) {
                    this.i_mapX = req.mapX();
                    this.i_mapY = req.mapY();
                    this.i_signUpPin.css("left", this.i_mapX + "%");
                    this.i_signUpPin.css("top", this.i_mapY + "%");
                }
            }
        }
    }
});




var AdminControls = Class.extend(Observer, {
    _name : "AdminControls",

    init : function(queue, elem) {
        this.i_queue = queue;
        this.i_elem = elem;

        this.i_elem.append("<p><b>Admin Controls</b></p>");
        var clearQueueButton = $('<button type="button" class="btn btn-danger adminOnly" data-toggle="modal" data-target="#clearTheQueueDialog">Clear the queue</button>');
        this.i_queue.makeActiveOnClick(clearQueueButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.i_elem.append(clearQueueButton);

        this.i_elem.append(" ");
        var openScheduleDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#scheduleDialog">Schedule</button>');
        this.i_queue.makeActiveOnClick(openScheduleDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.i_elem.append(openScheduleDialogButton);

        this.i_elem.append(" ");
        var openPartnershipsDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#partnershipsDialog">Partnerships</button>');
        this.i_queue.makeActiveOnClick(openPartnershipsDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.i_elem.append(openPartnershipsDialogButton);
    }

});


var StudentQueueRequest = Class.extend({
    _name: "Queue",

    init: function (queue, elem, data) {

        this.i_queue = queue;

        this.i_elem = elem;
    }
});

var QueueEntry = Class.extend(Observable, {
    _name : "QueueEntry",

    init : function(queue, data, elem) {
        this.i_queue = queue;
        this.i_elem = elem;

        this.i_id = data["id"];
        this.i_email = data["email"];

        this.i_isMe = !!data["name"]; // if it has a name it's them

        var infoElem = $('<div class="queue-entryInfo"></div>');

        var name = data["name"] ? data["name"] + " (" + data["email"] + ")" : "Anonymous Student";
        this.i_nameElem = $('<p><span class="glyphicon glyphicon-education"></span></p>')
            .append(" " + name)
            .appendTo(infoElem);
        this.i_name = data["name"];

        if (data["location"] && data["location"].length > 0){
            this.i_locationElem = $('<p><span class="glyphicon glyphicon-map-marker"></span></p>')
                .append(" " + data["location"])
                .appendTo(infoElem);
            this.i_location = data["location"];
        }

        if (data["description"] && data["description"].length > 0){
            this.i_descriptionElem = $('<p><span class="glyphicon glyphicon-question-sign"></span></p>')
                .append(" " + data["description"])
                .appendTo(infoElem);
            this.i_description = data["description"];
        }

        var timeWaiting = Date.now() - new Date(parseInt(data["ts"])*1000);
        var minutesWaiting = Math.round(timeWaiting / 1000 / 60);
        this.i_tsElem = $('<p><span class="glyphicon glyphicon-time"></span></p>')
            .append(" " + minutesWaiting + " min")
            .appendTo(infoElem);

        var removeButton = $('<button type="button" class="btn btn-danger">Remove</button>');
        if (!this.i_isMe){
            removeButton.addClass("adminOnly");
        }

        removeButton.on("click", this.i_queue.removeRequest.bind(this.i_queue, this));
        infoElem.append(removeButton);

        infoElem.append(" ");


        var sendMessageButton = $('<button type="button" class="btn btn-warning adminOnly">Message</button>');
        var self = this;
        sendMessageButton.on("click", function(){
            var sendMessageDialog = $("#sendMessageDialog");
            sendMessageDialog.modal("show");
            QueueApplication.setSendMessagePostId(self.i_id);
        });
        infoElem.append(sendMessageButton);



        if(this.i_queue.hasMap() && data["mapX"] !== undefined && data["mapY"] !== undefined) {
            var mapX = this.i_mapX = parseFloat(data["mapX"]);
            var mapY = this.i_mapY = parseFloat(data["mapY"]);

            var mapElem = $('<div class="adminOnly" style="display:inline-block; vertical-align: top; width: 25%; margin-right: 10px"></div>');
            this.i_elem.append(mapElem);

            var mapHolder = $('<div style="position: relative"></div>');
            this.i_mapElem = $('<img class="adminOnly queue-entryMap" src="img/' + this.i_queue.mapImageSrc() + '"></img>');
            mapHolder.append(this.i_mapElem);
            this.i_mapPin = $('<span class="adminOnly queue-locatePin"><span class="glyphicon glyphicon-map-marker" style="position:absolute; left:-1.3ch;top:-0.95em;"></span></span>');
            this.i_mapPin.css("left", mapX + "%");
            this.i_mapPin.css("top", mapY + "%");
            mapHolder.append(this.i_mapPin);
            mapElem.append(mapHolder);


            // var locateButton = $('<button type="button" class="btn btn-info adminOnly">Locate</button>');
            // var self = this;
            // locateButton.on("click", function(){
            //     self.i_queue.locateOnMap(self.i_mapX, self.i_mapY);
            // });
            // this.i_elem.append(locateButton);
            // this.i_elem.append(" ");
        }
        else {
            // var dibsButton = $('<button type="button" class="btn btn-info adminOnly">Dibs!</button>');
            // this.i_elem.append(dibsButton);
            // this.i_elem.append(" ");
        }

        this.i_elem.append(infoElem);
    },
    name : function() {
      return this.i_name;
    },

    location : function() {
        return this.i_location;
    },

    description : function() {
        return this.i_description;
    },

    mapX : function() {
        return this.i_mapX;
    },

    mapY : function() {
        return this.i_mapY;
    },

    requestId : function() {
        return this.i_id;
    },

    email : function() {
        return this.i_email;
    },

    onRemove : function() {
        // this.send("removed");
        this.i_elem.slideUp(ANIMATION_DELAY, function(){
            $(this).remove();
        });
    }
});

// Target is set below subclasses
var UserBase = Class.extend({
    _name: "User",

    signIn : function(email, idtoken) {
        var newUser = AuthenticatedUser.instance(email, idtoken);
        User.setTarget(newUser);

        var accountMessageElem = $("#accountMessage");
        // If they're not umich, they can't sign up!
        if (!newUser.isUmich()){
            accountMessageElem.show();
            accountMessageElem.html("Hi " + newUser.i_email + "! Please <a>sign out</a> and switch to an @umich.edu account to use the queue.");
            var self = this;
            accountMessageElem.find("a").click(function(){
                var auth2 = gapi.auth2.getAuthInstance();
                auth2.disconnect().then(function () {
                    User.signOut();
                    accountMessageElem.hide();
                });
            });

            $(".openSignUpDialogButton").prop("disabled", true);
        }


        return this.s_instance;
    },
    signOut : function() {
        var accountMessageElem = $("#accountMessage");
        if (this.s_instance) {
            // If we have a user, need to notify any courses for which they were admin
            for(var i = 0; i < this.i_admins.length; ++i) {
                this.i_admins[i].setAdmin(false);
            }
            // TODO Move to subclass hook
        }

        accountMessageElem.hide();

        User.setTarget(UnauthenticatedUser.instance());
    },

    isUmich : Class._ABSTRACT,
    idToken : Class._ABSTRACT,
    isCourseAdmin : function() {
        return false;
    },

    onFinishSigningIn : function() {
        // Notify the application there's a new user in town
        QueueApplication.userSignedIn();
    },

    isMe : Class._ABSTRACT

});

var AuthenticatedUser = UserBase.extend({

    init : function(email, idtoken) {
        this.i_email = email;
        this.i_idToken = idtoken;
        this.i_admins = {};

        this.ajax({
            type: "POST",
            url: "api/login",
            data: {
                idtoken: this.i_idToken
            },
            success: function (data) {
              this.i_checkAdmin();
            },
            error: oops
        });

    },

    isUmich : function() {
        return this.i_email.endsWith("@umich.edu");
    },

    isMe : function(email) {
        return this.i_email === email;
    },

    idToken : function() {
        return this.i_idToken;
    },

    i_checkAdmin : function() {
        return this.ajax({
            type: "POST",
            url: "api/adminCourses",
            data: {
                idtoken: this.i_idToken
            },
            dataType: "json",
            success: function (data) {
                this.i_admins = {};
                // TODO change to map js style wheeee
                for(var i = 0; i < data.length; ++i){
                    var courseId = data[i]["courseId"];
                    this.i_admins[courseId] = true;
                }

		// TODO HACK If admin for anything, give them fast refresh
                // should only be on the queues they administer
                // also if admin prompt for notifications
		if (data.length > 0) {
                  setInterval(function() {
                    QueueApplication.refreshActiveQueue();
                  }, 5000);

                  if (Notification) {
                    Notification.requestPermission();
                  }
                }
                else {
                  setInterval(function() {
                    QueueApplication.refreshActiveQueue();
                  }, 60000);
                }

                this.onFinishSigningIn();
            },
            error: oops
        });
    },

    isCourseAdmin : function (courseId) {
        return this.i_admins[courseId];
    }

});


var UnauthenticatedUser = UserBase.extend({

    init : function() {
        this.onFinishSigningIn();
        setInterval(function() {
          QueueApplication.refreshActiveQueue();
        }, 60000);

    },

    isUmich : function() {
        return false;
    },

    isMe : function(email) {
        return false;
    },

    idToken : function() {
        return "";
    }
});

var User = UserBase.singleton();

var Schedule = Singleton(Class.extend({
    _name: "Schedule",

    i_sequence : {
        "o": "c",
        "c": "p",
        "p": "o"
    },

    init : function(elem) {
        var dialog = $("#scheduleDialog");

        var self = this;
        $("#scheduleForm").submit(function(e){
            e.preventDefault();

            self.update();

            dialog.modal("hide");
            return false;
        });

        dialog.on('shown.bs.modal', function () {
            self.refresh();
        });

        // Set up table in schedule picker
        var schedulePicker = $("#schedulePicker");

        // First row of table with time headers
        var firstRow = $("<tr></tr>").appendTo(schedulePicker);

        // Extra blank in first row to correspond to row labels in other rows
        firstRow.append('<td style="width:1em; padding-right: 3px;"></td>');

        for(var i = 0; i < 24; ++i) {
            firstRow.append('<td colspan="2">' + (i === 0 || i === 12 ? 12 : i % 12) + '</td>');
        }

        this.i_unitElems = [];
        var dayLetters = ["S","M","T","W","T","F","S"];
        for(var r = 0; r < 7; ++r) {
            var day = [];
            var rowElem = $('<tr></tr>');
            rowElem.append('<td style="width:1em; text-align: right; padding-right: 3px;">' + dayLetters[r] + '</td>');
            for(var c = 0; c < 48; ++c) {
                var unitElem = $('<td><div class="scheduleUnit"></div></td>').appendTo(rowElem).find(".scheduleUnit");
                day.push(unitElem);
            }
            this.i_unitElems.push(day);
            schedulePicker.append(rowElem);
        }

        var pressed = false;
        schedulePicker.on("mousedown", function(e){
            e.preventDefault();
            pressed = true;
            return false;
        });
        schedulePicker.on("mouseup", function(){
            pressed = false;
        });
        schedulePicker.on("mouseleave", function(){
            pressed = false;
        });
        dialog.on('hidden.bs.modal', function () {
            pressed = false;
        });

        var changeColor = function(elem) {
            if (pressed){
                var currentType = elem.data("scheduleType");
                elem.removeClass("scheduleUnit-" + currentType);

                var nextType = self.i_sequence[currentType];
                elem.data("scheduleType", nextType);
                elem.addClass("scheduleUnit-" + nextType);
            }
        };
        schedulePicker.on("mouseover", ".scheduleUnit", function(e){
            e.preventDefault();
            changeColor($(this));
            return false;
        });
        schedulePicker.on("mousedown", ".scheduleUnit", function(e){
            e.preventDefault();
            pressed = true;
            changeColor($(this));
            return false;
        });
    },

    refresh : function() {
        if (!QueueApplication.activeQueue()) { return; }

        return this.ajax({
            type: "GET",
            url: "api/schedule/" + QueueApplication.activeQueue().queueId(),
            dataType: "json",
            success: function(data) {
                var schedule = data; // array of 7 strings
                for(var r = 0; r < 7; ++r) {
                    for(var c = 0; c < 48; ++c) {
                        var elem = this.i_unitElems[r][c];
                        elem.removeClass(); // removes all classes
                        elem.addClass("scheduleUnit");
                        elem.addClass("scheduleUnit-" + schedule[r].charAt(c));
                        elem.data("scheduleType", schedule[r].charAt(c));
                    }
                }
            },
            error: oops
        });
    },

    update : function() {
        if (!QueueApplication.activeQueue()) { return; }

        // lol can't make up my mind whether I like functional vs. iterative
        var schedule = [];
        for(var r = 0; r < 7; ++r) {
            schedule.push(this.i_unitElems[r].map(function(unitElem){
                return unitElem.data("scheduleType");
            }).join(""));
        }

        return this.ajax({
            type: "POST",
            url: "api/updateSchedule",
            data: {
                idtoken: User.idToken(),
                queueId: QueueApplication.activeQueue().queueId(),
                schedule: schedule
            },
            success: function() {
                console.log("schedule updated");
            },
            error: oops
        });
    }


}));

// Give warning to users in Safari/iOS private browsing
// mode that Google sign-in won't work.
// TODO: I'm not convinced this actually does anything
//https://gist.github.com/philfreo/68ea3cd980d72383c951
if (typeof sessionStorage === 'object') {
    try {
        sessionStorage.setItem('localStorage', 1);
        sessionStorage.removeItem('localStorage');
    } catch (e) {
        oops("It looks like local storage is disabled in your browser. This may aggravate an issue with Google sign-in on Safari or iOS while using private browsing mode.");
    }
}

function oops(xhr, textStatus){
    if (textStatus === "abort") { return; }
    console.log("Oops. An error occurred. Try refreshing the page.");
    $("#oopsDialog").modal("show");
}

function showErrorMessage(message) {
    console.log(message);
    $("#errorMessage").html(message);
    $("#errorDialog").modal("show");
}
