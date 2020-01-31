/**
 * Created by James Juett on 9/5/2016.
 */

import bootbox from "bootbox"

// import "./util/util.js"
function debug(message: string, category: string) {
    if (category){
        console.log(category + ": " + message);
        $(".debug."+category).html(""+message); //""+ is to force conversion to string (via .toString if object)
    }
    else{
        console.log(message);
        $(".debug.debugAll").html(""+message); //""+ is to force conversion to string (via .toString if object)
    }
}

var assert = function(condition: any, message = "") {
    if (!condition)
        throw Error("Assert failed: " + message);
};

interface Array<T> {
    clear() : void;
} 
Array.prototype.clear = function () {
    this.length = 0;
}

import {Observable, MessageResponses, messageResponse} from "./util/mixins";
import escape from "lodash/escape"
import endsWith from "lodash/endsWith"

var ANIMATION_DELAY = 500;

export class QueueApplication {
    private static _name = "QueueApplication";

    public static readonly instance : QueueApplication;

    public static createInstance(elem: JQuery) {
        (<QueueApplication>QueueApplication.instance) = new QueueApplication(elem);
    }

    private elem : JQuery;
    private coursePills : JQuery;
    private coursePanes : JQuery;

    private courses : Course[] = [];
    private _activeQueue? : Queue;

    private messagesShown : {[index:string]: boolean} = {};
    private sendMessagePostId?: string;

    public readonly observable = new Observable(this);

    private constructor(elem : JQuery) {
        this.elem = elem;
        this.coursePills = elem.find(".coursePills");
        this.coursePanes = elem.find(".coursePanes");

        this.loadCourses();
    }

    public async loadCourses() {
        try{
            let list = await $.getJSON("api/courseList");
            this.onCoursesLoad(list);
        }
        catch(e) {
            oops(e, e);
        }
    }

    public onCoursesLoad(list : {[index:string]: string}[]) {
        this.coursePills.empty();
        this.coursePanes.empty();
        this.courses.clear();


        // No active course initially
        this.coursePanes.append($('<div class="tab-pane fade in active"><h1><span class="glyphicon glyphicon-arrow-left"></span> Please select a course.</h1></div>'));

        list.forEach((courseData) => {

            // Escape everything
            // TODO redundant - this happens on the server
            for (var key in courseData){
                courseData[key] = escape(courseData[key]);
            }

            let courseId = courseData["courseId"];

            // Add the pill used to select the course
            let pillElem = $('<li><a href="#' + courseId + '" data-toggle="pill"><h3>' + courseId + '</h3></a></li>');
            this.coursePills.append(pillElem);

            // Add the element that will contain the course content
            let courseElem = $('<div id="' + courseId + '" class="tab-pane fade"></div>');
            this.coursePanes.append(courseElem);

            // Create the course itself
            let course = new Course(courseData, courseElem);
            this.courses.push(course);

            pillElem.find("a").click(function(){
                course.makeActive();
            });
        });
    }

    public setActiveQueue(queue : any) {
        this._activeQueue = queue;
        console.log("Setting active queue to " + queue.queueId);
        this.updateSignUpForm();
        this.observable.send("activeQueueSet");
    }

    public activeQueue() {
        return this._activeQueue;
    }

    public updateSignUpForm() {
        if (this._activeQueue && this._activeQueue.hasMap()) {
            $("#signUpMapHolder").show();
            $("#signUpMapMessage").show();
            $("#signUpMapImage").attr("src", this._activeQueue.mapImageSrc);
        }
        else {
            $("#signUpMapHolder").hide();
            $("#signUpMapMessage").hide();
        }
    }

    public userSignedIn() {
        this.courses.forEach((course) => {
            course.userSignedIn();
        });
    }

    public refreshActiveQueue() {
        this._activeQueue && this._activeQueue.refresh();
        this.refreshContent();
    }

    public message(message: {[index:string]: string}) {
        if (!this.messagesShown[message.id]){
            this.messagesShown[message.id] = true;
            $("#messageDialogHeader").html('Message');
            $("#messageDialogContent").append('<p><span class="label label-info">'  + message["sender"] + '</span> ' + message["message"] + '</p>');
            $("#messageDialog").modal("show");
        }
    }

    public setSendMessagePostId(id: string) {
        this.sendMessagePostId = id;
    }

    public sendMessage(message: string) {
        $.ajax({
            type: "POST",
            url: "api/sendMessage",
            data: {
                idtoken: User.idToken(),
                id: this.sendMessagePostId,
                message: message
            },
            success: function(){
            },
            error: oops
        });
    }

    public refreshContent() {
        if (this._activeQueue) {
            document.title = this._activeQueue.course.shortName + " OH (" + this._activeQueue.numEntries + ")";
        }
    }

    public notify(title: string, message: string) {
      if (!Notification) {
        alert(message);
      }
      else {
        // TODO: bug in typescript requires cast below. Can be removed eventually.
        if ((<any>Notification).permission !== "granted") {
          Notification.requestPermission();
        }
        else {
          new Notification(title, {
            body: message
          });
        }
      }
    }
}

class Course {
    public readonly courseId : string;
    public readonly shortName : string;
    public readonly fullName : string;

    private isAdmin : boolean = false;
    private queues : any[] = [];
    private activeQueue : any;

    private readonly elem : JQuery;
    private readonly queuePillsElem : JQuery;
    private readonly pickAQueueElem : JQuery;
    private readonly mainElem : JQuery;
    private readonly queuePanesElem : JQuery;
    private readonly contentElem : JQuery;
    
    constructor(data: {[index:string]: string}, elem: JQuery) {

        this.courseId = data["courseId"];
        this.shortName = data["shortName"];
        this.fullName = data["fullName"];

        this.elem = elem;

        this.queuePillsElem = $('<ul class="queuePills nav nav-pills"></ul>');
        this.elem.append(this.queuePillsElem);

        this.pickAQueueElem = $('<div></div>');
        this.pickAQueueElem.append($('<h3><span class="glyphicon glyphicon-arrow-up"></span> Several queues are available for ' + this.shortName + '. Please select one.</h3>'));
        this.elem.append(this.pickAQueueElem);

        this.mainElem = $('<div></div>');
        this.mainElem.hide();

        this.queuePanesElem = $('<div class="col-xs-12 col-md-12 queuePanes tab-content"></div>');
        this.mainElem.append(this.queuePanesElem);

        this.contentElem = $('<div class="col-xs-12 col-md-12"></div>');
        this.mainElem.append(this.contentElem);

        this.elem.append(this.mainElem);

        this.loadContent();
        this.loadQueues();
    }

    public makeActive() {
        // Don't need to do anything in particular for the course itself,
        // but we do need to make sure the active queue within this course
        // is the active queue overall since it will be shown.
        this.activeQueue && this.activeQueue.makeActive();
    }

    private loadContent() {
        this.contentElem.load("queue-component/courseContent/" + this.courseId);
    }

    private loadQueues() {
        return $.ajax({
            type: "GET",
            url: "api/queueList/" + this.courseId,
            dataType: "json",
            success: (data) => {
                this.onQueuesLoad(data);
            },
            error: oops
        });
    }

    private onQueuesLoad(list : any[]) {
        this.queues.clear();
        this.queuePillsElem.empty();
        this.queuePanesElem.empty();

        list.forEach((item) => {
            var name = item["name"];
            var queueId = item["queueId"];

            // Add pills for each queue belonging to this course
            var pillElem = $('<li><a data-toggle="pill"><h6>' + name + '</h6></a></li>');
            pillElem.find("a").prop("href", "#queue" + queueId);
            this.queuePillsElem.append(pillElem);

            // Add panes to hold the queue
            var queueElem = $('<div id="queue' + queueId + '"></div>');
            queueElem.addClass("tab-pane fade");
            this.queuePanesElem.append(queueElem);

            // Create the queue objects themselves
            var queue = new Queue(item, this, queueElem);
            this.queues.push(queue);

            queue.refresh();

            pillElem.find("a").click(() => {
                this.pickAQueueElem.empty();
                this.activeQueue = queue;
                this.mainElem.show();
                queue.makeActive();
            });
        });


        // If only one queue, select it automatically
        // (pillElem and queueElem are still in scope even after the loop body)
        if (this.queues.length === 1) {
            this.queuePillsElem.children().first().addClass("active");
            this.queuePanesElem.children().first().addClass("in active");
            this.activeQueue = this.queues[0];
            this.pickAQueueElem.hide();
            this.mainElem.show();
        }
        else{
            this.pickAQueueElem.show();
            this.mainElem.hide();
        }

        this.setAdmin(User.isCourseAdmin(this.courseId));
    }

    public setAdmin(isAdmin : boolean){
        this.isAdmin = isAdmin;
        for(var i = 0; i < this.queues.length; ++i) {
            this.queues[i].setAdmin(isAdmin)
        }
        if (this.isAdmin) {
            this.elem.addClass("admin");
            this.elem.removeClass("notAdmin");
        }
        else{
            this.elem.addClass("notAdmin");
            this.elem.removeClass("admin");
        }
    }

    public userSignedIn(){
        this.setAdmin(User.isCourseAdmin(this.courseId));
        this.queues.forEach(function(queue){
            queue.userSignedIn();
        });
    }

}

class Announcement {
    public readonly id : number;
    public readonly content : string;
    public readonly ts : string;

    public readonly queue : Queue;
    
    private readonly elem : JQuery;

    constructor(data: {[index:string]: any}, queue : Queue, elem : JQuery) {
        this.id = data["id"];
        this.content = data["content"];
        this.ts = data["ts"];
        this.queue = queue;
        this.elem = elem;

        let panelBody: JQuery;
        this.elem.addClass("panel panel-info").append(
            panelBody = $('<div class="panel-body bg-info"></div>')
                .append('<span class="glyphicon glyphicon-bullhorn"></span> ')
                .append($('<strong>' + this.content + '</strong>'))
        );
        $('<button type="button" class="close adminOnly">&times;</button>')
            .appendTo(panelBody)
            .click((e) => {
                // TODO: Remove ugly confirm
                if (confirm("Are you sure you want to remove this announcement?\n\n" + this.content)) {
                    this.remove();
                }
            });
    }

    public remove() {
        $.ajax({
            type: "DELETE",
            url: "api/announcements/" + this.id,
            success : () => {
                this.queue.refresh();
            },
            error: oops
        });
    }
}

class Queue {
    private static _name: "Queue";
    
    private readonly observable = new Observable(this);

    public readonly course: Course;

    public readonly queueId: string;
    public readonly location: string;
    public readonly name: string;

    public readonly isAdmin: boolean = false;
    public readonly numEntries: number = 0;
    public readonly lastRefresh: Date = new Date();
    public readonly isOpen: boolean = false;
    public readonly myRequest: QueueEntry | null = null;
    public readonly mapImageSrc: string = "";

    private readonly elem: JQuery;
    private readonly numEntriesElem: JQuery;
    private readonly lastRefreshElem: JQuery;
    private readonly statusMessageElem: JQuery;
    private readonly announcementContainerElem: JQuery;
    private readonly adminStatusElem: JQuery;
    private readonly adminControlsElem: JQuery;
    private readonly studentControlsElem: JQuery;
    private readonly queueElem: JQuery;
    private readonly stackElem: JQuery;

    private readonly adminControls: AdminControls;
    private readonly studentControls: StudentControls;
    
    private refreshDisabled = false;
    private currentRefreshIndex = 0;

    constructor(data: {[index:string]: any}, course: Course, elem: JQuery) {

        this.course = course;

        this.queueId = data["queueId"];
        this.location = data["location"];
        this.mapImageSrc = data["map"] ? data["map"] : "";
        this.name = data["name"];
        this.elem = elem;

        this.isAdmin = false;
        this.numEntries = 0;
        this.currentRefreshIndex = 0;
        this.lastRefresh = new Date();
        this.isOpen = false;
        this.refreshDisabled = false;
        
        this.announcementContainerElem = $('<div></div>').appendTo(this.elem);
        

        var statusElem = $('<p></p>').appendTo(this.elem);
        statusElem.append(
            $('<span data-toggle="tooltip" title="Number of Students"><span class="glyphicon glyphicon-education"></span></span>')
                .append(" ")
                .append(this.numEntriesElem = $('<span></span>'))
        );
        statusElem.append('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
        statusElem.append(
            $('<span data-toggle="tooltip" title="Last Refresh"><span class="glyphicon glyphicon-refresh"></span></span>')
                .append(" ")
                .append(this.lastRefreshElem = $('<span></span>'))
        );
        statusElem.append('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');

        this.statusMessageElem = $('<span>Loading queue information...</span>');
        statusElem.append(this.statusMessageElem);

        this.adminStatusElem = $('<span class="adminOnly"><b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;You are an admin for this queue.</b></span>');
        statusElem.append(this.adminStatusElem);

        this.adminControlsElem = $('<div class="panel panel-default adminOnly"><div class="panel-body"></div></div>')
            .appendTo(this.elem)
            .find(".panel-body");

        this.adminControls = new AdminControls(this, this.adminControlsElem);
        // this.observable.addListener(this.adminControls); // AdminControls currently not an Observer

        this.studentControlsElem = $('<div class="panel panel-default"><div class="panel-body"></div></div>')
            .appendTo(this.elem)
            .find(".panel-body");

        this.studentControls = new StudentControls(this, this.studentControlsElem);
        this.observable.addListener(this.studentControls);

        // TODO: is this old?
        // if (this.hasMap()) {
        //     this.adminControlsElem.append('<p class="adminOnly">Click the "Locate" button on a student\'s request to update the map.</p>');
        //     var mapHolder = $('<div style="position: relative; margin-top: 10px;"></div>');
        //     this.mapElem = $('<img class="adminOnly queue-staffMap" src="img/' + this.mapImageSrc + '"></img>');
        //     mapHolder.append(this.mapElem);
        //     this.mapPin = $('<span class="adminOnly queue-locatePin"><span class="glyphicon glyphicon-map-marker" style="position:absolute; left:-1.3ch;top:-0.95em;"></span></span>');
        //     mapHolder.append(this.mapPin);
        //     this.adminControlsElem.append(mapHolder);
        // }

        this.queueElem = $('<div></div>').appendTo(this.elem);
	    this.stackElem = $('<div class="adminOnly"></div>').appendTo(this.elem);

        this.elem.find('[data-toggle="tooltip"]').tooltip();

        this.userSignedIn(); // TODO change name to updateUser?
    }

    public makeActiveOnClick(elem : JQuery) {
        elem.click(() => {
            this.makeActive();
        });
    }

    public makeActive() {
        QueueApplication.instance.setActiveQueue(this);
        this.refresh();
    }

    public refresh() {

        // myRefreshIndex is captured in a closure with the callback.
        // if refresh had been called again, the index won't match and
        // we don't do anything. this prevents the situation where someone
        // signs up but then a pending request from before they did so finishes
        // and causes it to look like they were immediately removed. this also
        // fixes a similar problem when an admin removes someone but then a
        // pending refresh makes them pop back up temporarily.
        this.currentRefreshIndex += 1;
        var myRefreshIndex = this.currentRefreshIndex;

        return $.ajax({
            type: "POST",
            url: "api/list",
            data: {
                queueId: this.queueId
            },
            dataType: "json",
            success: (data) => {
                // if another refresh has been requested, ignore the results of this one
                if (myRefreshIndex === this.currentRefreshIndex){
                    this.refreshResponse(data);
                }
            },
            error: oops
        });
    }

    public refreshResponse(data : {[index: string]: any}) {

        if (this.refreshDisabled) {
          return;
        }

        // Message for individual user
        if (data["message"]) {
            QueueApplication.instance.message(data["message"]);
        }

        // Announcement for this queue as a whole
        this.announcementContainerElem.empty();
        let announcementsData = <any[]>data["announcements"];
        announcementsData.forEach((aData: any) => {
            let announcementElem = $("<div></div>").appendTo(this.announcementContainerElem);
            new Announcement(aData, this, announcementElem);
        })
        if (announcementsData.length > 0) {
            this.announcementContainerElem.show();
        }
        else {
            this.announcementContainerElem.hide();
        }


        (<boolean>this.isOpen) = data["isOpen"];
        if (this.isOpen) {
            this.statusMessageElem.html("The queue is open.");
        }
        else {
            let schedule = data["schedule"];
            let halfHour = data["halfHour"];
            let nextOpen = -1;
            for(let i = halfHour; i < 48; ++i) {
                let scheduleType = schedule.charAt(i);
                if (scheduleType === "o" || scheduleType === "p") {
                    nextOpen = i;
                    break;
                }
            }

            if (nextOpen === -1) {
                this.statusMessageElem.html("The queue is closed for today.");
            }
            else {
                let d = new Date();
                d.setHours(0);
                d.setMinutes(0);
                d.setSeconds(0);

                let newDate = new Date(d.getTime() + nextOpen*30*60000);
                this.statusMessageElem.html("The queue is closed right now. It will open at " + newDate.toLocaleTimeString() + ".");
            }


        }


        let queue = data["queue"];
        this.queueElem.empty();
        let queueEntries = [];
        let myRequest : (QueueEntry | null) = null;
        for(let i = 0; i < queue.length; ++i) {
            let item = queue[i];

            let itemElem = $("<li class='list-group-item'></li>");
            let entry = new QueueEntry(this, item, i, itemElem);
            queueEntries.push(entry);

            if (!myRequest && User.isMe(entry.email)) {
                myRequest = entry;
            }

            this.queueElem.append(itemElem);

        }
        this.setMyRequest(myRequest);


        this.observable.send("queueRefreshed");

        // console.log(JSON.stringify(data["stack"], null, 4));
        this.stackElem.html("<h3>The Stack</h3><br /><p>Most recently removed at top</p><pre>" + JSON.stringify(data["stack"], null, 4) + "</pre>");


        var oldNumEntries = this.numEntries;
        (<number>this.numEntries) = queue.length;
        if(this.isAdmin && oldNumEntries === 0 && this.numEntries > 0) {
          QueueApplication.instance.notify("Request Received!", queueEntries[0].name);
        }

        (<Date>this.lastRefresh) = new Date();


        this.numEntriesElem.html(""+this.numEntries);
        this.lastRefreshElem.html(this.lastRefresh.toLocaleTimeString());
    }

    public setMyRequest(myRequest: QueueEntry | null) {
        (<QueueEntry | null>this.myRequest) = myRequest;
        this.observable.send("myRequestSet");
    }

    public removeRequest(request: QueueEntry) {
        console.log("attempting to remove " + request.email + " from queue " + this.queueId);
        this.disableRefresh();
        var self = this;
        $.ajax({
            type: "POST",
            url: "api/remove",
            data: {
                id: request.id
            },
            success : function() {
                console.log("successfully removed " + request.email + " from queue " + self.queueId);
                request.onRemove();
            },
            error: oops
        }).always(function(){
            setTimeout(function(){
                self.enableRefresh();
                self.refresh();
            }, ANIMATION_DELAY)
        });
    }

    public cancelIncomingRefresh() {
      this.currentRefreshIndex += 1;
    }

    public disableRefresh() {
      this.refreshDisabled = true;
    }

    public enableRefresh() {
      this.refreshDisabled = false;
    }

    public clear() {
        return $.ajax({
            type: "POST",
            url: "api/clear",
            data: {
                idtoken: User.idToken(),
                queueId: this.queueId
            },
            success: () => { this.clearList() },
            error: oops
        });
    }

    private clearList() {
        this.queueElem.children().slideUp();
    }

    public signUp(name: string, location: string, description: string, mapX?: number, mapY?: number) {
        return $.ajax({
            type: "POST",
            url: "api/signUp",
            data: {
                idtoken: User.idToken(),
                queueId: this.queueId,
                name: name,
                location: location,
                mapX: mapX,
                mapY: mapY,
                description: description
            },
            dataType: "json",
            success: (data) => {
                if (data["fail"]) {
                    showErrorMessage(data["reason"]);
                }
                else {
                    this.refresh();
                }
            },
            error: oops
        });
    }

    public updateRequest(name: string, location: string, description: string, mapX?: number, mapY?: number) {
        return $.ajax({
            type: "POST",
            url: "api/updateRequest",
            data: {
                id: this.myRequest!.id,
                name: name,
                location: location,
                mapX: mapX,
                mapY: mapY,
                description: description
            },
            dataType: "json",
            success: (data) => {
                if (data["fail"]) {
                    showErrorMessage(data["reason"]);
                }
                else {
                    this.refresh();
                }
            },
            error: oops
        });
    }

    public setAdmin(isAdmin: boolean) {
        var oldAdmin = this.isAdmin;
        (<boolean>this.isAdmin) = isAdmin;

        // If our privileges change, hit the server for appropriate data,
        // because it gives out different things for normal vs. admin
        if (oldAdmin != this.isAdmin) {
            this.refresh();
        }
    }

    private userSignedIn() {
        this.observable.send("userSignedIn");
    }

    public hasMap() {
        return this.mapImageSrc !== "";
    }

    public updateGroups(formData: FormData) {
        formData.append("queueId", this.queueId);
        $.ajax({
            type: "POST",
            url: "api/updateGroups",
            cache: false,
            contentType: false,
            processData: false,
            data: formData,
            dataType: "json",
            success: function(data){
                if (data['success']) {
                    alert("groups uploaded successfully");
                }
                else {
                    alert("error uploading groups. roster and groups have been cleared - you'll have to upload them again, sorry!");
                }
                //     // if another refresh has been requested, ignore the results of this one
                //     if (myRefreshIndex === self.currentRefreshIndex){
                //         self.refreshResponse(data);
                //     }
            },
            error: function(data){
                alert("error uploading groups");
            }
        });

    }

    public updateConfiguration(options: {[index: string]: string;}) {
        options.queueId = this.queueId;
        return $.ajax({
            type: "POST",
            url: "api/updateQueueConfiguration",
            data: options,
            dataType: "json",
            success: (data) => {
                if (data["fail"]) {
                    showErrorMessage(data["reason"]);
                }
                else {

                }
            },
            error: oops
        });
    }

    public addAnnouncement(content: string) {
        return $.ajax({
            type: "POST",
            url: "api/announcements",
            data: {
                queueId: this.queueId,
                content: content
            },
            success: () => {
                this.refresh();
            },
            error: oops
        });
    }
}

class StudentControls {
    private static _name = "StudentControls";

    private static UPDATE_REQUEST_BUTTON_UP_TO_DATE = "<span class='glyphicon glyphicon-ok'></span> Request Updated";
    private static UPDATE_REQUEST_BUTTON_UPDATE = "Update Request";

    private queue: Queue;

    private formHasChanges: boolean;

    private elem: JQuery;
    private statusElem: JQuery;
    private signUpForm: JQuery;
    private signUpNameInput: JQuery;
    private signUpDescriptionInput: JQuery;
    private signUpLocationInput: JQuery;
    private mapHolder?: JQuery;
    private signUpMap?: JQuery;
    private signUpPin?: JQuery;
    private mapX?: number;
    private mapY?: number;
    private signUpButtons: JQuery;
    private updateRequestButtons: JQuery;

    public readonly _act! : MessageResponses;

    constructor(queue: Queue, elem: JQuery) {
        this.queue = queue;
        this.elem = elem;

        this.formHasChanges = false;

        let containerElem = $('<div></div>');

        let regularFormElem;
        this.signUpForm = $('<form id="signUpForm" role="form" class="form-horizontal"></form>')
            .append(regularFormElem = $('<div></div>')
                .append($('<div class="form-group"></div>')
                    .append('<label class="control-label col-sm-3" for="signUpName' + queue.queueId + '">Name:</label>')
                    .append($('<div class="col-sm-9"></div>')
                        .append(this.signUpNameInput = $('<input type="text" class="form-control" id="signUpName' + queue.queueId + '" required="required" maxlength="30" placeholder="Nice to meet you!">'))
                    )
                )
                .append($('<div class="form-group"></div>')
                    .append('<label class="control-label col-sm-3" for="signUpDescription' + queue.queueId + '">Description:</label>')
                    .append($('<div class="col-sm-9"></div>')
                        .append(this.signUpDescriptionInput = $('<input type="text" class="form-control" id="signUpDescription' + queue.queueId + '"required="required" maxlength="100" placeholder="e.g. Segfault in function X, using the map data structure, etc.">'))
                    )
                )
                .append($('<div class="form-group"></div>')
                    .append('<label class="control-label col-sm-3" for="signUpLocation' + queue.queueId + '">Location:</label>')
                    .append($('<div class="col-sm-9"></div>')
                        .append(this.signUpLocationInput = $('<input type="text" class="form-control" id="signUpLocation' + queue.queueId + '"required="required" maxlength="30" placeholder="e.g. Computer #36, laptop by glass/atrium door, etc.">'))
                    )
                )
                .append('<div class="' + (this.queue.hasMap() ? 'hidden-xs' : '') + ' form-group"><div class="col-sm-offset-3 col-sm-9"><button type="submit" class="btn btn-success queue-signUpButton">Sign Up</button> <button type="submit" class="btn btn-success queue-updateRequestButton" style="display:none;"></button></div></div>')
            );

        containerElem.append(this.signUpForm);

        this.statusElem = $("<div></div>");
        containerElem.append(this.statusElem);

        this.signUpForm.find("input").on("input", () => {
            this.formChanged();
        });


        if (this.queue.hasMap()) {
            regularFormElem.addClass("col-xs-12 col-sm-8");
            regularFormElem.css("padding", "0");
            this.signUpForm.append(this.mapHolder = $('<div class="col-xs-12 col-sm-4" style="position: relative; padding:0"></div>')
                .append(this.signUpMap = $('<img src="img/' + this.queue.mapImageSrc + '" class="queue-signUpMap" style="width:100%"></img>'))
                .append(this.signUpPin = $('<span class="queue-locatePin"><span class="glyphicon glyphicon-map-marker" style="position:absolute; left:-1.3ch;top:-0.95em;"></span></span>'))
            );

            // Add different layout for sign up button on small screens
            this.signUpForm.append($('<div class="visible-xs col-xs-12" style="padding: 0;"><div class="form-group"><div class="col-sm-offset-3 col-sm-9"><button type="submit" class="btn btn-success queue-signUpButton">Sign Up</button> <button type="submit" class="btn btn-success queue-updateRequestButton" style="display:none;"></button></div></div></div>'));

            var pin = this.signUpPin;
            this.mapX = 50;
            this.mapY = 50;
            let self = this;
            this.signUpMap.click(function (e) { //Offset mouse Position
                // Use ! for non-null assertion
                self.mapX = 100 * Math.trunc((e.pageX - $(this).offset()!.left)) / $(this).width()!;
                self.mapY = 100 * Math.trunc(e.pageY - $(this).offset()!.top) / $(this).height()!;
                // var pinLeft = mapX - pin.width()/2;
                // var pinTop = mapY - pin.height();
                pin.css("left", self.mapX + "%");
                pin.css("top", self.mapY + "%");
                self.formChanged();
//            alert("x:" + mapX + ", y:" + mapY);
            });

            // Disable regular location input
            this.signUpLocationInput.val("Click on the map!");
            this.signUpLocationInput.prop("disabled", true);
        }

        this.signUpForm.submit((e) => {
            e.preventDefault();
            var signUpName: string = <string>this.signUpNameInput.val();
            var signUpDescription: string = <string>this.signUpDescriptionInput.val();
            var signUpLocation: string = <string>this.signUpLocationInput.val();

            if (!signUpName || signUpName.length == 0 ||
                !signUpLocation || signUpLocation.length == 0 ||
                !signUpDescription || signUpDescription.length == 0){
                showErrorMessage("You must fill in all the fields.");
                return false;
            }

            if (!this.queue.myRequest) {
                this.queue.signUp(
                    signUpName,
                    signUpLocation,
                    signUpDescription,
                    this.mapX,
                    this.mapY);
            }
            else {
                this.queue.updateRequest(
                    signUpName,
                    signUpLocation,
                    signUpDescription,
                    this.mapX,
                    this.mapY);
            }


            this.formHasChanges = false;
            this.updateRequestButtons.removeClass("btn-warning");
            this.updateRequestButtons.addClass("btn-success");
            this.updateRequestButtons.prop("disabled", true);
            this.updateRequestButtons.html(StudentControls.UPDATE_REQUEST_BUTTON_UP_TO_DATE);
            return false;
        });

        this.signUpButtons = this.signUpForm.find("button.queue-signUpButton");
        this.updateRequestButtons = this.signUpForm.find("button.queue-updateRequestButton")
            .prop("disabled", true).html(StudentControls.UPDATE_REQUEST_BUTTON_UP_TO_DATE);

        this.elem.append(containerElem);
    }

    public formChanged() {
        if (this.queue.myRequest) {
            this.formHasChanges = true;
            this.updateRequestButtons.removeClass("btn-success");
            this.updateRequestButtons.addClass("btn-warning");
            this.updateRequestButtons.prop("disabled", false);
            this.updateRequestButtons.html(StudentControls.UPDATE_REQUEST_BUTTON_UPDATE);
        }
    }

    public refreshSignInEnabled() {
        var isEnabled = User.isUmich() && this.queue.isOpen && !this.queue.myRequest;
        this.signUpButtons.prop("disabled", !isEnabled);

        if (this.queue.myRequest) {
            this.updateRequestButtons.show();
        }
    }

    @messageResponse()
    private queueRefreshed() {
        this.refreshSignInEnabled();
    }

    @messageResponse()
    private userSignedIn() {
        this.refreshSignInEnabled();
    }

    @messageResponse()
    private myRequestSet() {
        var req = this.queue.myRequest;
        this.statusElem.html("");
        if (req) {
            if (!this.formHasChanges) {
                this.signUpNameInput.val(req.name);
                this.signUpDescriptionInput.val(req.description || "");
                this.signUpLocationInput.val(req.location || "");
                if (this.queue.hasMap()) {
                    this.mapX = req.mapX;
                    this.mapY = req.mapY;
                    this.signUpPin!.css("left", this.mapX + "%");
                    this.signUpPin!.css("top", this.mapY + "%");
                }
            }
            
            this.statusElem.html("You are at position " + req.index + " in the queue.");
            if (req.tag) {
                this.statusElem.prepend('<span class="label label-info">' + req.tag + '</span> ');
            }
        }
    }
}



class AdminControls {
    private static _name = "AdminControls";

    private queue: any;
    private elem: JQuery;

    constructor(queue: any, elem: JQuery) {
        this.queue = queue;
        this.elem = elem;

        this.elem.append("<p><b>Admin Controls</b></p>");
        var clearQueueButton = $('<button type="button" class="btn btn-danger adminOnly" data-toggle="modal" data-target="#clearTheQueueDialog">Clear the queue</button>');
        this.queue.makeActiveOnClick(clearQueueButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(clearQueueButton);

        this.elem.append(" ");
        var openScheduleDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#scheduleDialog">Schedule</button>');
        this.queue.makeActiveOnClick(openScheduleDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(openScheduleDialogButton);

        this.elem.append(" ");
        var openManageQueueDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#manageQueueDialog">Manage Queue</button>');
        this.queue.makeActiveOnClick(openManageQueueDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(openManageQueueDialogButton);

        this.elem.append(" ");
        let openAddAnnouncementDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#addAnnouncementDialog">Add Announcement</button>');
        this.queue.makeActiveOnClick(openAddAnnouncementDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(openAddAnnouncementDialogButton);
    }
};

class QueueEntry {
    private static _name = "QueueEntry";

    private queue: any;
    
    public readonly id: string;
    public readonly email: string;
    public readonly index: number;
    public readonly name: string;
    public readonly isMe: boolean;
    public readonly location?: string;
    public readonly description?: string;
    public readonly tag?: string;
    public readonly mapX?: number;
    public readonly mapY?: number;

    private elem: JQuery;
    private nameElem: JQuery;
    private locationElem?: JQuery;
    private descriptionElem?: JQuery;
    private tagElem?: JQuery;
    private tsElem: JQuery;
    private mapElem?: JQuery;
    private mapPin?: JQuery;


    constructor(queue: any, data: {[index:string]: string}, index: number, elem: JQuery) {
        this.queue = queue;

        this.id = data["id"];
        this.email = data["email"];

        this.index = index;
        this.isMe = !!data["name"]; // if it has a name it's them

        this.elem = elem;

        let infoElem = $('<div class="queue-entryInfo"></div>');

        let name = data["name"] ? data["name"] + " (" + data["email"] + ")" : "Anonymous Student";
        this.nameElem = $('<p><span class="glyphicon glyphicon-education"></span></p>')
            .append(" " + name)
            .appendTo(infoElem);
        if (data["tag"] && data["tag"].length > 0) {
            this.tag = data["tag"];
            this.nameElem.append(' <span class="label label-info">' + this.tag + '</span>');
        }
        this.name = data["name"];

        if (data["location"] && data["location"].length > 0){
            this.locationElem = $('<p><span class="glyphicon glyphicon-map-marker"></span></p>')
                .append(" " + data["location"])
                .appendTo(infoElem);
            this.location = data["location"];
        }

        if (data["description"] && data["description"].length > 0){
            this.descriptionElem = $('<p><span class="glyphicon glyphicon-question-sign"></span></p>')
                .append(" " + data["description"])
                .appendTo(infoElem);
            this.description = data["description"];
        }

        let timeWaiting = Date.now() - new Date(parseInt(data["ts"])*1000).getTime();
        let minutesWaiting = Math.round(timeWaiting / 1000 / 60);
        this.tsElem = $('<p><span class="glyphicon glyphicon-time"></span></p>')
            .append(" " + minutesWaiting + " min")
            .appendTo(infoElem);

        let removeButton = $('<button type="button" class="btn btn-danger">Remove</button>');
        if (!this.isMe){
            removeButton.addClass("adminOnly");
        }

        removeButton.on("click", this.queue.removeRequest.bind(this.queue, this));
        infoElem.append(removeButton);

        infoElem.append(" ");


        let sendMessageButton = $('<button type="button" class="btn btn-warning adminOnly">Message</button>');
        let self = this;
        sendMessageButton.on("click", function(){
            let sendMessageDialog = $("#sendMessageDialog");
            sendMessageDialog.modal("show");
            QueueApplication.instance.setSendMessagePostId(self.id);
        });
        infoElem.append(sendMessageButton);



        if(this.queue.hasMap() && data["mapX"] !== undefined && data["mapY"] !== undefined) {
            let mapX = this.mapX = parseFloat(data["mapX"]);
            let mapY = this.mapY = parseFloat(data["mapY"]);

            let mapElem = $('<div class="adminOnly" style="display:inline-block; vertical-align: top; width: 25%; margin-right: 10px"></div>');
            this.elem.append(mapElem);

            let mapHolder = $('<div style="position: relative"></div>');
            this.mapElem = $('<img class="adminOnly queue-entryMap" src="img/' + this.queue.mapImageSrc + '"></img>');
            mapHolder.append(this.mapElem);
            this.mapPin = $('<span class="adminOnly queue-locatePin"><span class="glyphicon glyphicon-map-marker" style="position:absolute; left:-1.3ch;top:-0.95em;"></span></span>');
            this.mapPin.css("left", mapX + "%");
            this.mapPin.css("top", mapY + "%");
            mapHolder.append(this.mapPin);
            mapElem.append(mapHolder);
        }
        else {
            // let dibsButton = $('<button type="button" class="btn btn-info adminOnly">Dibs!</button>');
            // this.elem.append(dibsButton);
            // this.elem.append(" ");
        }

        this.elem.append(infoElem);
    }

    public onRemove() {
        // this.send("removed");
        this.elem.slideUp(ANIMATION_DELAY, function(){
            $(this).remove();
        });
    }
};


export class Schedule {
    private static readonly _name: "Schedule";

    private static readonly sequence = {
        "o": "c",
        "c": "p",
        "p": "o"
    };

    private readonly unitElems : JQuery[][];

    constructor(elem : JQuery) {
        let dialog = $("#scheduleDialog");

        $("#scheduleForm").submit((e) => {
            e.preventDefault();

            this.update();

            dialog.modal("hide");
            return false;
        });

        dialog.on('shown.bs.modal', () => {
            this.refresh();
        });

        // Set up table in schedule picker
        let schedulePicker = $("#schedulePicker");

        // First row of table with time headers
        let firstRow = $("<tr></tr>").appendTo(schedulePicker);

        // Extra blank in first row to correspond to row labels in other rows
        firstRow.append('<td style="width:1em; padding-right: 3px;"></td>');

        for(var i = 0; i < 24; ++i) {
            firstRow.append('<td colspan="2">' + (i === 0 || i === 12 ? 12 : i % 12) + '</td>');
        }

        this.unitElems = [];
        let dayLetters = ["S","M","T","W","T","F","S"];
        for(var r = 0; r < 7; ++r) {
            var day : JQuery[] = [];
            var rowElem = $('<tr></tr>');
            rowElem.append('<td style="width:1em; text-align: right; padding-right: 3px;">' + dayLetters[r] + '</td>');
            for(var c = 0; c < 48; ++c) {
                var unitElem = $('<td><div class="scheduleUnit"></div></td>').appendTo(rowElem).find(".scheduleUnit");
                day.push(unitElem);
            }
            this.unitElems.push(day);
            schedulePicker.append(rowElem);
        }

        let pressed = false;
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

        let changeColor = (elem: JQuery) =>{
            if (pressed){
                var currentType: "o" | "c" | "p" = elem.data("scheduleType");
                elem.removeClass("scheduleUnit-" + currentType);

                var nextType = Schedule.sequence[currentType];
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
    }

    public refresh() {
        let aq = QueueApplication.instance.activeQueue();
        if (aq) {
            return $.ajax({
                type: "GET",
                url: "api/schedule/" + aq.queueId,
                dataType: "json",
                success: (data) => {
                    var schedule = data; // array of 7 strings
                    for(var r = 0; r < 7; ++r) {
                        for(var c = 0; c < 48; ++c) {
                            var elem = this.unitElems[r][c];
                            elem.removeClass(); // removes all classes
                            elem.addClass("scheduleUnit");
                            elem.addClass("scheduleUnit-" + schedule[r].charAt(c));
                            elem.data("scheduleType", schedule[r].charAt(c));
                        }
                    }
                },
                error: oops
            });
        }

    }

    public update() {
        if (!QueueApplication.instance.activeQueue()) { return; }

        // lol can't make up my mind whether I like functional vs. iterative
        var schedule = [];
        for(var r = 0; r < 7; ++r) {
            schedule.push(this.unitElems[r].map(function(unitElem){
                return unitElem.data("scheduleType");
            }).join(""));
        }

        let aq = QueueApplication.instance.activeQueue();
        if (aq) {
            return $.ajax({
                type: "POST",
                url: "api/updateSchedule",
                data: {
                    idtoken: User.idToken(),
                    queueId: aq.queueId,
                    schedule: schedule
                },
                success: function() {
                    console.log("schedule updated");
                },
                error: oops
            });
        }
    }
}

export class ManageQueueDialog {
    private static readonly _name: "ManageQueueDialog";

    private static readonly POLICIES_UP_TO_DATE = '<span><span class="glyphicon glyphicon-floppy-saved"></span> Saved</span>';
    private static readonly POLICIES_UNSAVED = '<span><span class="glyphicon glyphicon-floppy-open"></span> Update Configuration</span>';

    public readonly _act! : MessageResponses;

    private readonly updateConfigurationButton : JQuery;

    constructor() {
        let dialog = $("#manageQueueDialog");

        let groupsForm = $("#groupsForm");
        groupsForm.submit(function(e){
            e.preventDefault();
            let formData = new FormData(<HTMLFormElement>groupsForm[0]);
            let aq = QueueApplication.instance.activeQueue();
            aq && aq.updateGroups(formData);
            return false;
        });

        let policiesForm = $("#policiesForm");
        policiesForm.submit((e) => {
            e.preventDefault();

            this.update();

            return false;
        });

        this.updateConfigurationButton = $("#updateConfigurationButton");

        $("#preventUnregisteredCheckbox").change(this.unsavedChanges.bind(this));
        $("#preventGroupsCheckbox").change(this.unsavedChanges.bind(this));
        $("#prioritizeNewCheckbox").change(this.unsavedChanges.bind(this));
        $("#preventGroupsBoostCheckbox").change(this.unsavedChanges.bind(this));

        QueueApplication.instance.observable.addListener(this);
        this.refresh();
    }

    @messageResponse("activeQueueSet")
    public refresh() {
        let aq = QueueApplication.instance.activeQueue();
        if (!aq) { return;}
        if (!aq.isAdmin) { return; }

        $("#checkQueueRosterLink").attr("href", "api/roster/" + aq.queueId);
        $("#checkQueueGroupsLink").attr("href", "api/groups/" + aq.queueId);

        return $.ajax({
            type: "GET",
            url: "api/queueConfiguration/" + aq.queueId,
            dataType: "json",
            success: this.refreshResponse.bind(this),
            error: oops
        });
    }

    private refreshResponse(data : {[index:string]: string}) {
        console.log(JSON.stringify(data));
        $("#preventUnregisteredCheckbox").prop("checked", data["preventUnregistered"] === "y");
        $("#preventGroupsCheckbox").prop("checked", data["preventGroups"] === "y");
        $("#prioritizeNewCheckbox").prop("checked", data["prioritizeNew"] === "y");
        $("#preventGroupsBoostCheckbox").prop("checked", data["preventGroupsBoost"] === "y");

        this.changesUpToDate();
    }

    public update() {
        let aq = QueueApplication.instance.activeQueue();
        if (!aq) { return;}
        aq.updateConfiguration({
            preventUnregistered : $("#preventUnregisteredCheckbox").is(":checked") ? "y" : "n",
            preventGroups : $("#preventGroupsCheckbox").is(":checked") ? "y" : "n",
            prioritizeNew : $("#prioritizeNewCheckbox").is(":checked") ? "y" : "n",
            preventGroupsBoost : $("#preventGroupsBoostCheckbox").is(":checked") ? "y" : "n"
        }).done(this.changesUpToDate.bind(this));
    }

    private unsavedChanges() {
        this.updateConfigurationButton.html(ManageQueueDialog.POLICIES_UNSAVED)
            .prop("disabled", false)
            .removeClass("btn-success")
            .addClass("btn-warning");
    }

    private changesUpToDate() {
        this.updateConfigurationButton.html(ManageQueueDialog.POLICIES_UP_TO_DATE)
            .prop("disabled", true)
            .removeClass("btn-warning")
            .addClass("btn-success");
    }
}

export namespace User {

    export function signIn(email: string, idtoken: string) {
        let newUser = new AuthenticatedUser(email, idtoken);

        var accountMessageElem = $("#accountMessage");
        // If they're not umich, they can't sign up!
        if (!newUser.isUmich()){
            accountMessageElem.show();
            accountMessageElem.html("Hi " + newUser.email + "! Please <a>sign out</a> and switch to an @umich.edu account to use the queue.");
            accountMessageElem.find("a").click(function(){
                var auth2 = gapi.auth2.getAuthInstance();
                auth2.disconnect().then(function () {
                    User.signOut();
                    accountMessageElem.hide();
                });
            });

            $(".openSignUpDialogButton").prop("disabled", true);
        }
        else {
            accountMessageElem.empty();
            accountMessageElem.hide();
        }
    }

    export function signOut() {
        var accountMessageElem = $("#accountMessage");
        accountMessageElem.hide();

        theUser && theUser.onSignOut();

        new UnauthenticatedUser(); // will implicitly set theUser singleton instance
    }

    export function idToken() {
        return theUser.idToken();
    }

    export function isUmich() {
        return theUser.isUmich();
    }

    export function isCourseAdmin(courseId: string) {
        return theUser.isCourseAdmin(courseId);
    }

    export function isMe(email: string) {
        return theUser.isMe(email);
    }

    abstract class UserBase {
        private static _name = "UserBase";
    
        public abstract isUmich() : boolean;
        public abstract idToken() : string;
        public abstract isCourseAdmin(courseId: string) : boolean;
        public abstract isMe(email: string) : boolean;
    
        public onSignOut() {
            // nothing to do here for now
        }

        public onFinishSigningIn() {
            theUser = this;
    
            // Notify the application there's a new user in town
            QueueApplication.instance && QueueApplication.instance.userSignedIn();
        }
    
    }

    class AuthenticatedUser extends UserBase {

        public readonly email: string;
        private readonly _idToken: string;
        private admins: {[index: string]: boolean} = {};

        constructor(email: string, idtoken: string) {
            super();
            this.email = email;
            this._idToken = idtoken;
            
            $.ajax({
                type: "POST",
                url: "api/login",
                data: {
                    idtoken: this.idToken()
                },
                success: (data) => {
                  this.checkAdmin();
                },
                error: oops
            });
    
        }
    
        public isUmich() : boolean {
            return endsWith(this.email, "@umich.edu");
        }
    
        public isMe(email: string) : boolean {
            return this.email === email;
        }
    
        public idToken() : string {
            return this._idToken;
        }
    
        private checkAdmin() : void {
            $.ajax({
                type: "POST",
                url: "api/adminCourses",
                data: {
                    idtoken: this.idToken()
                },
                dataType: "json",
                success: (data) => {
                    for (var i = 0; i < data.length; ++i) {
                        this.admins[data[i]["courseId"]] = true;
                    }

                    // TODO HACK If admin for anything, give them fast refresh
                    // should only be on the queues they administer
                    // also if admin prompt for notifications
                    if (data.length > 0) {
                        setInterval(function () {
                            QueueApplication.instance.refreshActiveQueue();
                        }, 5000);

                        if (Notification) {
                            Notification.requestPermission();
                        }
                    }
                    else {
                        setInterval(function () {
                            QueueApplication.instance.refreshActiveQueue();
                        }, 60000);
                    }

                    this.onFinishSigningIn();
                },
                error: oops
            });
        }
    
        public isCourseAdmin(courseId: string) : boolean {
            return this.admins[courseId];
        }
    
    }

    class UnauthenticatedUser extends UserBase {

        constructor() {
            super();
            
            this.onFinishSigningIn();
            
            setInterval(function() {
              QueueApplication.instance.refreshActiveQueue();
            }, 60000);

            // TODO: clean up where the refresh intervals get set
            //       right now it seems like multiple can get set
    
        }
    
        public isUmich() : boolean { return false; }
        public idToken() : string { return ""; }
        public isCourseAdmin(courseId: string) : boolean { return false; }
        public isMe(email: string) : boolean { return false; }

    }

    let theUser: UserBase = new UnauthenticatedUser();

} // end User namespace


// Give warning to users in Safari/iOS private browsing
// mode that Google sign-in won't work.
// TODO: I'm not convinced this actually does anything
//https://gist.github.com/philfreo/68ea3cd980d72383c951
if (typeof sessionStorage === 'object') {
    try {
        sessionStorage.setItem('localStorage', "1");
        sessionStorage.removeItem('localStorage');
    } catch (e) {
        oops(null, "It looks like local storage is disabled in your browser. This may aggravate an issue with Google sign-in on Safari or iOS while using private browsing mode.");
    }
}

function oops(xhr: any, textStatus: any){
    if (textStatus === "abort") { return; }
    console.log("Oops. An error occurred. Try refreshing the page.");
    $("#oopsDialog").modal("show");
}

function showErrorMessage(message: any) {
    console.log(message);
    $("#errorMessage").html(message);
    $("#errorDialog").modal("show");
}
