import { Course, QueueApplication, User } from "./QueueApplication";
import { MessageResponses, messageResponse, addListener, Observable } from "./util/mixins";
import { oops, showErrorMessage } from "./util/util";
import { Page } from "./Queue";
import $ from 'jquery';


var ANIMATION_DELAY = 500;

export class OrderedQueue {

    public readonly observable = new Observable(this);

    public readonly page: Page;

    public readonly myRequest: QueueEntry | null = null;

    public readonly isOpen: boolean = false;
    public readonly numEntries: number;

    private readonly elem: JQuery;
    private readonly adminControlsElem: JQuery;
    private readonly studentControlsElem: JQuery;
    private readonly queueElem: JQuery;
    private readonly stackElem: JQuery;

    private readonly adminControls: AdminControls;
    private readonly studentControls: StudentControls;

    constructor(data: {[index:string]: any}, page: Page, elem: JQuery) {
        this.page = page;
        this.elem = elem;

        this.isOpen = false;
        this.numEntries = 0;

        this.adminControlsElem = $('<div class="panel panel-default adminOnly"><div class="panel-body"></div></div>')
            .appendTo(this.elem)
            .find(".panel-body");

        this.adminControls = new AdminControls(this, this.adminControlsElem);

        this.studentControlsElem = $('<div class="panel panel-default"><div class="panel-body"></div></div>')
            .appendTo(this.elem)
            .find(".panel-body");

        this.studentControls = new StudentControls(this, this.studentControlsElem);
        addListener(this, this.studentControls);
        addListener(this.page, this.studentControls);

        this.queueElem = $('<div></div>').appendTo(this.elem);
        this.stackElem = $('<div class="adminOnly"></div>').appendTo(this.elem);
    }

    // protected readonly refreshType = "POST";
    // protected refreshUrl() {
    //     return "api/list";
    // }
    // protected readonly refreshDataType = "json";
    // protected refreshData() {
    //     return {
    //         queueId: this.queueId
    //     }
    // }
    
    public refreshRequest() {
        return $.ajax({
            type: "POST",
            url: "api/list",
            data: {queueId: this.page.queueId},
            dataType: "json"
        });
    }
    
    public refreshResponse(data : {[index: string]: any}) {

        (<boolean>this.isOpen) = data["isOpen"];
        if (this.isOpen) {
            this.page.setStatusMessage("The queue is open.");
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
                this.page.setStatusMessage("The queue is closed for today.");
            }
            else {
                let d = new Date();
                d.setHours(0);
                d.setMinutes(0);
                d.setSeconds(0);

                let newDate = new Date(d.getTime() + nextOpen*30*60000);
                this.page.setStatusMessage("The queue is closed right now. It will open at " + newDate.toLocaleTimeString() + ".");
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
        if(this.page.isAdmin && oldNumEntries === 0 && this.numEntries > 0) {
          QueueApplication.instance.notify("Request Received!", queueEntries[0].name);
        }

        this.page.setNumEntries(this.numEntries);
    }

    public setMyRequest(myRequest: QueueEntry | null) {
        (<QueueEntry | null>this.myRequest) = myRequest;
        this.observable.send("myRequestSet");
    }

    public removeRequest(request: QueueEntry) {
        console.log("attempting to remove " + request.email + " from queue " + this.page.queueId);
        this.page.disableRefresh();
        $.ajax({
            type: "POST",
            url: "api/remove",
            data: {
                id: request.id
            },
            success : () => {
                console.log("successfully removed " + request.email + " from queue " + this.page.queueId);
                request.onRemove();
            },
            error: oops
        }).always(() => {
            setTimeout(() => {
                this.page.enableRefresh();
                this.page.refresh();
            }, ANIMATION_DELAY)
        });
    }
    

    public clear() {
        return $.ajax({
            type: "POST",
            url: "api/clear",
            data: {
                idtoken: User.idToken(),
                queueId: this.page.queueId
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
                queueId: this.page.queueId,
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
                    this.page.refresh();
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
                    this.page.refresh();
                }
            },
            error: oops
        });
    }
}


class StudentControls {
    private static _name = "StudentControls";

    private static UPDATE_REQUEST_BUTTON_UP_TO_DATE = "<span class='glyphicon glyphicon-ok'></span> Request Updated";
    private static UPDATE_REQUEST_BUTTON_UPDATE = "Update Request";

    private queue: OrderedQueue;

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

    constructor(queue: OrderedQueue, elem: JQuery) {
        this.queue = queue;
        this.elem = elem;

        this.formHasChanges = false;

        let containerElem = $('<div></div>');

        let regularFormElem;
        this.signUpForm = $('<form id="signUpForm" role="form" class="form-horizontal"></form>')
            .append(regularFormElem = $('<div></div>')
                .append($('<div class="form-group"></div>')
                    .append('<label class="control-label col-sm-3" for="signUpName' + queue.page.queueId + '">Name:</label>')
                    .append($('<div class="col-sm-9"></div>')
                        .append(this.signUpNameInput = $('<input type="text" class="form-control" id="signUpName' + queue.page.queueId + '" required="required" maxlength="30" placeholder="Nice to meet you!">'))
                    )
                )
                .append($('<div class="form-group"></div>')
                    .append('<label class="control-label col-sm-3" for="signUpDescription' + queue.page.queueId + '">Description:</label>')
                    .append($('<div class="col-sm-9"></div>')
                        .append(this.signUpDescriptionInput = $('<input type="text" class="form-control" id="signUpDescription' + queue.page.queueId + '"required="required" maxlength="100" placeholder="e.g. Segfault in function X, using the map data structure, etc.">'))
                    )
                )
                .append($('<div class="form-group"></div>')
                    .append('<label class="control-label col-sm-3" for="signUpLocation' + queue.page.queueId + '">Location:</label>')
                    .append($('<div class="col-sm-9"></div>')
                        .append(this.signUpLocationInput = $('<input type="text" class="form-control" id="signUpLocation' + queue.page.queueId + '"required="required" maxlength="30" placeholder="e.g. Computer #36, laptop by glass/atrium door, etc.">'))
                    )
                )
                .append('<div class="' + (this.queue.page.hasMap() ? 'hidden-xs' : '') + ' form-group"><div class="col-sm-offset-3 col-sm-9"><button type="submit" class="btn btn-success queue-signUpButton">Sign Up</button> <button type="submit" class="btn btn-success queue-updateRequestButton" style="display:none;"></button></div></div>')
            );

        containerElem.append(this.signUpForm);

        this.statusElem = $("<div></div>");
        containerElem.append(this.statusElem);

        this.signUpForm.find("input").on("input", () => {
            this.formChanged();
        });


        if (this.queue.page.hasMap()) {
            regularFormElem.addClass("col-xs-12 col-sm-8");
            regularFormElem.css("padding", "0");
            this.signUpForm.append(this.mapHolder = $('<div class="col-xs-12 col-sm-4" style="position: relative; padding:0"></div>')
                .append(this.signUpMap = $('<img src="img/' + this.queue.page.mapImageSrc + '" class="queue-signUpMap" style="width:100%"></img>'))
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
                if (this.queue.page.hasMap()) {
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

    private queue: OrderedQueue;
    private elem: JQuery;

    constructor(queue: OrderedQueue, elem: JQuery) {
        this.queue = queue;
        this.elem = elem;

        this.elem.append("<p><b>Admin Controls</b></p>");
        var clearQueueButton = $('<button type="button" class="btn btn-danger adminOnly" data-toggle="modal" data-target="#clearTheQueueDialog">Clear the queue</button>');
        this.queue.page.makeActiveOnClick(clearQueueButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(clearQueueButton);

        this.elem.append(" ");
        var openScheduleDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#scheduleDialog">Schedule</button>');
        this.queue.page.makeActiveOnClick(openScheduleDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(openScheduleDialogButton);

        this.elem.append(" ");
        var openManageQueueDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#manageQueueDialog">Manage Queue</button>');
        this.queue.page.makeActiveOnClick(openManageQueueDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(openManageQueueDialogButton);

        this.elem.append(" ");
        let openAddAnnouncementDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#addAnnouncementDialog">Add Announcement</button>');
        this.queue.page.makeActiveOnClick(openAddAnnouncementDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(openAddAnnouncementDialogButton);
    }
};

class QueueEntry {
    private static _name = "QueueEntry";

    private queue: OrderedQueue;
    
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


    constructor(queue: OrderedQueue, data: {[index:string]: string}, index: number, elem: JQuery) {
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



        if(this.queue.page.hasMap() && data["mapX"] !== undefined && data["mapY"] !== undefined) {
            let mapX = this.mapX = parseFloat(data["mapX"]);
            let mapY = this.mapY = parseFloat(data["mapY"]);

            let mapElem = $('<div class="adminOnly" style="display:inline-block; vertical-align: top; width: 25%; margin-right: 10px"></div>');
            this.elem.append(mapElem);

            let mapHolder = $('<div style="position: relative"></div>');
            this.mapElem = $('<img class="adminOnly queue-entryMap" src="img/' + this.queue.page.mapImageSrc + '"></img>');
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