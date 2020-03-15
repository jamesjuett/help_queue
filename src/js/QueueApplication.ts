/**
 * Created by James Juett on 9/5/2016.
 */

import {Observable, MessageResponses, messageResponse} from "./util/mixins";
import escape from "lodash/escape"
import endsWith from "lodash/endsWith"
import { Mutable, oops } from "./util/util";
import { QueueKind, Page } from "./Queue";
import { OrderedQueue } from "./OrderedQueue";
import { AppointmentsQueue } from "./AppointmentsQueue";
import { User } from "./User";
import { data } from "jquery";

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
    private _activePage? : Page;

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
        this._activePage = queue;
        console.log("Setting active queue to " + queue.queueId);
        this.updateSignUpForm();
        this.observable.send("activeQueueSet");
    }

    public activeQueue() {
        return this._activePage;
    }

    public updateSignUpForm() {
        if (this._activePage && this._activePage.hasMap()) {
            $("#signUpMapHolder").show();
            $("#signUpMapMessage").show();
            $("#signUpMapImage").attr("src", this._activePage.mapImageSrc);
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

    public refreshActivePage() {
        this._activePage && this._activePage.refresh();
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
        if (this._activePage) {
            let title = this._activePage.course.shortName + " OH";
            if (this._activePage.queue instanceof OrderedQueue) {
                title += " (" + this._activePage.queue.numEntries + ")";
            }
            document.title = title;
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

export class Course {
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
            var queue = new Page(data, this, item["queueKind"], queueElem);
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