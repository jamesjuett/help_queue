import { Page } from "./Queue";
import { Course, QueueApplication, User } from "./QueueApplication";
import { oops, showErrorMessage, Mutable, assert } from "./util/util";
import $ from 'jquery';
import moment, { duration } from "moment-timezone";
import { MessageResponses, messageResponse, Observable, addListener, Message } from "./util/mixins";
import { SignUpForm, SignUpMessage, AppointmentSchedule, Appointment, filterAppointmentsSchedule } from "./OrderedQueue";
import 'jquery.scrollto';


export class AppointmentsQueue {

    public readonly observable = new Observable(this);
    public readonly page: Page;

    public readonly myRequest: Appointment | null = null;

    private readonly elem: JQuery;
    private readonly adminControlsElem: JQuery;
    private readonly studentControlsElem: JQuery;
    private readonly appointmentsElem: JQuery;
    // private readonly stackElem: JQuery;

    private readonly adminControls: AdminControls;
    private readonly studentControls: StudentControls;

    constructor(data: {[index:string]: any}, page: Page, elem: JQuery) {
        this.page = page;
        this.elem = elem;

        this.adminControlsElem = $('<div class="panel panel-default adminOnly"><div class="panel-body"></div></div>')
            .appendTo(this.elem)
            .find(".panel-body");

        this.adminControls = new AdminControls(this, this.adminControlsElem);

        this.studentControlsElem = $('<div class="panel panel-default"><div class="panel-body"></div></div>')
            .appendTo(this.elem)
            .find(".panel-body");

        this.studentControls = new StudentControls(this, this.studentControlsElem);
        this.observable.addListener(this.studentControls);

        this.appointmentsElem = $("<div></div>").appendTo(elem);

    }

    
    // $.getJSON(`api/queues/${this.queueId}/appointments/0`).then((a) => console.log(JSON.stringify(a, null, 4)));
    // $.getJSON(`api/queues/${this.queueId}/appointmentsSchedule`).then((a) => console.log(JSON.stringify(a, null, 4)));
    
    public refreshRequest() {
        let email = User.email();
        // if (!email) {
        //     return;
        // }
        return Promise.all([
            $.ajax({
                type: "GET",
                url: `api/queues/${this.page.queueId}/appointments/0/${email}`,
                dataType: "json"
            }),
            $.ajax({
                type: "GET",
                url: `api/queues/${this.page.queueId}/appointments/0`,
                dataType: "json"
            }),
            $.ajax({
                type: "GET",
                url: `api/queues/${this.page.queueId}/appointmentsSchedule/0`,
                dataType: "json"
            }),
        ]);
    }

    public refreshResponse(data : any) {

        let scheduleData = data[2];
        let duration: number = scheduleData["duration"];
        let padding: number = scheduleData["padding"];
        let scheduledTime = moment().tz("America/New_York").startOf("day");
        let totalAvailable = 0;
        let totalStillAvailable = 0;
        let schedule: AppointmentSchedule = (<string>scheduleData["schedule"]).split("").map((n, i) => {
            let slots = {
                timeslot: i,
                duration: duration,
                scheduledTime: scheduledTime.clone(),
                numAvailable: parseInt(n),
                numFilled: 0
            };
            
            scheduledTime = scheduledTime.add(duration, 'm');
            totalAvailable += slots.numAvailable;
            if (slots.scheduledTime.diff(now) > 0) {
                totalStillAvailable += slots.numAvailable;
            }
            return slots;
        });

        
        // let appointments : any[][] = [];
        // for(let i = 0; i < schedule.length; ++i) {
        //     appointments.push([]);
        // }
        let appointmentsData : any[] = data[1];
        let startOfDay = moment().tz("America/New_York").startOf("day");
        let now = moment();
        let totalFilled = 0;
        let totalStillFilled = 0;
        let appointments : Appointment[] = appointmentsData.map((appData: any) => {

            let appt = createAppointment(appData, startOfDay);
            ++schedule[appt.timeslot].numFilled;
            ++totalFilled;
            if (appt.scheduledTime.diff(now) > 0) {
                ++totalStillFilled;
            }

            return appt;
        });

        
        this.page.setStatusMessage(`${totalStillAvailable-totalStillFilled}/${totalStillAvailable} appointments available below!`);

        let myAppointments: Appointment[] = data[0];
        let myAppointment: Appointment | null = null;
        myAppointments.map((appData) => createAppointment(appData, startOfDay)).forEach(appt => {
            if (!myAppointment && User.isMe(appt.studentEmail) && now.diff(appt.scheduledTime, "minutes") < appt.duration) {
                myAppointment = appt;
            }
        });
        this.setMyAppointment(myAppointment);

        this.adminControls.setAppointments(schedule, appointments);
        this.studentControls.setAppointments(schedule);

        this.observable.send("queueRefreshed");


        // let queue = data["queue"];

        // this.page.setNumEntries(this.numEntries);
    }
    
    public setMyAppointment(myRequest: Appointment | null) {
        (<Appointment | null>this.myRequest) = myRequest;
        this.studentControls.setMyAppointment();
    }

    // public clear() {
    //     // Do nothing
    // }

    public signUp(name: string, location: string, description: string, mapX: number, mapY: number, timeslot: number) {
        return $.ajax({
            type: "POST",
            url: `api/queues/${this.page.queueId}/appointments/${timeslot}`,
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

    // public updateRequest(name: string, location: string, description: string, mapX?: number, mapY?: number) {
    //     return $.ajax({
    //         type: "POST",
    //         url: "api/updateRequest",
    //         data: {
    //             id: this.myRequest!.id,
    //             name: name,
    //             location: location,
    //             mapX: mapX,
    //             mapY: mapY,
    //             description: description
    //         },
    //         dataType: "json",
    //         success: (data) => {
    //             if (data["fail"]) {
    //                 showErrorMessage(data["reason"]);
    //             }
    //             else {
    //                 this.refresh();
    //             }
    //         },
    //         error: oops
    //     });
    // }

    public removeAppointment(app: Appointment) {
        console.log("attempting to remove " + app.studentEmail + " from queue " + this.page.queueId);
        this.page.disableRefresh();
        $.ajax({
            type: "DELETE",
            url: `api/appointments/${app.id}`,
            success : () => {
                console.log("successfully removed " + app.studentEmail + " from queue " + this.page.queueId);
            },
            error: oops
        }).always(() => {
            setTimeout(() => {
                this.page.enableRefresh();
                this.page.refresh();
            }, 100);
        });
    }
}

class AdminControls {

    private queue: AppointmentsQueue;
    private elem: JQuery;
    private appointmentsElem: JQuery;
    private appointmentsTableElem: JQuery;
    private headerElems?: JQuery[];
    private nameElem: JQuery;
    private descriptionElem: JQuery;
    private locationElem: JQuery;
    private crabsterNow: JQuery;
    private schedule?: AppointmentSchedule;
    private filteredSchedule?: AppointmentSchedule;
    private appointments?: Appointment[];

    constructor(queue: AppointmentsQueue, elem: JQuery) {
        this.queue = queue;
        this.elem = elem;

        this.elem.append("<p><b>Admin Controls</b></p>");

        // var clearQueueButton = $('<button type="button" class="btn btn-danger adminOnly" data-toggle="modal" data-target="#clearTheQueueDialog">Clear the queue</button>');
        // this.queue.page.makeActiveOnClick(clearQueueButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        // this.elem.append(clearQueueButton);

        this.elem.append(" ");
        var openScheduleDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#appointmentSlots">Appointment Slots</button>');
        this.queue.page.makeActiveOnClick(openScheduleDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(openScheduleDialogButton);

        // this.elem.append(" ");
        // var openManageQueueDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#manageQueueDialog">Manage Queue</button>');
        // this.queue.page.makeActiveOnClick(openManageQueueDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        // this.elem.append(openManageQueueDialogButton);

        this.elem.append(" ");
        let openAddAnnouncementDialogButton = $('<button type="button" class="btn btn-info adminOnly" data-toggle="modal" data-target="#addAnnouncementDialog">Add Announcement</button>');
        this.queue.page.makeActiveOnClick(openAddAnnouncementDialogButton); // TODO I don't think this is necessary anymore. If they can click it, it should be active.
        this.elem.append(openAddAnnouncementDialogButton);

        this.crabsterNow = $('<div class="crabster-now"><img src="img/crabster_sign.png"></img><span class="crabster-time"></span></div>');
        this.appointmentsElem = $('<div style="overflow-x: scroll"></div>')
            .append(this.appointmentsTableElem = $('<table style="position: relative"></table>').append(this.crabsterNow));
            

        this.elem.append(" ");
        $('<button type="button" class="btn btn-primary adminOnly">Now</button>')
            .click(() => this.scrollToNow(600))
            .appendTo(this.elem);

        // scroll to now, now and set an interval to scroll to now every 2 minutes
        this.scrollToNow(0);
        // setInterval(() => this.scrollToNow(600), 120000);

        setInterval(() => this.crawlToNow(3000), 5000);

        this.elem.append(this.appointmentsElem);

        let detailsElem = $('<div></div>').appendTo(this.elem);
        detailsElem.append('<span>name: </span>');
        detailsElem.append(this.nameElem = $('<span></span>'));
        detailsElem.append('<br />');
        detailsElem.append('<span>description: </span>');
        detailsElem.append(this.descriptionElem = $('<span></span>'));
        detailsElem.append('<br />');
        detailsElem.append('<span>location: </span>');
        detailsElem.append(this.locationElem = $('<span></span>'));
    }

    private scrollToNow(duration: number) {
        if (!this.filteredSchedule || this.filteredSchedule.length === 0) { return; }
        let schedule = this.filteredSchedule;
        let now = moment();
        let closestIndex = this.filteredSchedule.reduce((prev, current, i) => {
            return Math.abs(current.scheduledTime.diff(now)) < Math.abs(schedule[prev].scheduledTime.diff(now)) ? i : prev;
        }, 0);

        if (this.headerElems) {
            this.appointmentsElem.scrollTo(this.headerElems[closestIndex], duration, {easing: "swing"});
        }
    }
    
    private crawlToNow(duration: number) {
        if (!this.filteredSchedule || this.filteredSchedule.length === 0) { return; }
        let schedule = this.filteredSchedule;
        let now = moment();
        let closestIndex = this.filteredSchedule.reduce((prev, current, i) => {
            return Math.abs(current.scheduledTime.diff(now)) < Math.abs(schedule[prev].scheduledTime.diff(now)) ? i : prev;
        }, 0);

        if (this.headerElems) {
            console.log(this.headerElems[closestIndex].position().left + "px");
            this.crabsterNow.find(".crabster-time").html(now.tz("America/New_York").format("h:mm"));
            this.crabsterNow.animate({
                left: this.headerElems[closestIndex].position().left + "px"
            }, duration);
        }
    }

    public setAppointments(schedule: AppointmentSchedule, appointments: Appointment[]) {
        if (!this.queue.page.isAdmin) {
            return;
        }

        let firstTime = false;
        if (!this.appointments) {
            firstTime = true;
        }

        this.schedule = schedule;
        this.appointments = appointments;

        this.appointmentsTableElem.children("tr").remove();

        let maxAppts = schedule.reduce((prev, current) => Math.max(prev, current.numAvailable), 0);
        

        // Note: this needs to be done before the filtering below
        let appointmentsByTimeslot: Appointment[][] = [];
        schedule.forEach(() => appointmentsByTimeslot.push([]));
        appointments.forEach((appt) => appointmentsByTimeslot[appt.timeslot].push(appt));

        // filter to only times with some appointments available,
        // or the first in a sequence of no availability, which will be rendered as a "gap"
        this.filteredSchedule = schedule = filterAppointmentsSchedule(schedule);

        let now = moment();

        // header row with times
        let headerRow = $('<tr></tr>').appendTo(this.appointmentsTableElem);
        let headerElems: JQuery[] = this.headerElems = [];
        schedule.forEach((slots, i) => {
            let headerElem: JQuery;
            if (slots.numAvailable > 0) {
                headerElem = $(`<th class="appointment-slots-header"><span>${slots.scheduledTime.format("h:mma")}</span></th>`);
                if (slots.scheduledTime.format("h:mma").indexOf("00") !== -1) {
                    // on the hour
                    headerElem.addClass("appointment-slots-header-major");
                }
                else if (i === 0 || schedule[i-1].numAvailable === 0) {
                    // first timeslot or first after a gap
                    headerElem.addClass("appointment-slots-header-major");
                }
                else {
                    // otherwise, it's minor
                    headerElem.addClass("appointment-slots-header-major");
                }

                let diff = slots.scheduledTime.diff(now, "minutes");
                if (diff) {
                    // dim if appointment has recently passed
                    headerElem.addClass("appointment-slots-header-past");
                }
            }
            else {
                headerElem = $(`<th class="appointment-slots-header"><span>&nbsp</span></th>`);
            }
            headerElems.push(headerElem);
            headerRow.append(headerElem);
        });
        
        for(let r = 1; r <= maxAppts; ++r) {
            let row = $('<tr></tr>').appendTo(this.appointmentsTableElem);
            schedule.forEach((slots, i) => {

                let button;
                let appts = appointmentsByTimeslot[slots.timeslot];
                if (slots.numAvailable < r) {
                    // no appointment slot
                    button = $('<td class="appointment-cell appointment-cell-blank"><button type="button" class="btn btn-basic">&nbsp</button></td').appendTo(row);
                }
                else if (appts.length < r) {
                    // unfilled
                    button = $('<td class="appointment-cell"><button type="button" class="btn btn-default">&nbsp</button></td>').appendTo(row);
                }
                else {
                    // scheduled appointment
                    let appt = appts[r-1];
                    let uniqname = appt.studentEmail.replace(/@.*\..*/, "");
                    button = $(`<td class="appointment-cell"><span data-toggle="tooltip" data-html="true" title="${appt.name}<br />Click to show info below..."><button type="button" class="btn btn-primary">${uniqname}</button></span></td>`).appendTo(row);
                    button.find('[data-toggle="tooltip"]').tooltip();
                    button.find("button").click(() => {
                        this.nameElem.html(appt.name);
                        this.descriptionElem.html(appt.description);
                        this.locationElem.html(appt.location);
                    })
                }

                let diff = slots.scheduledTime.diff(now, "minutes");
                if (diff < -slots.duration) {
                    // dim if appointment has passed
                    button.addClass("appointment-cell-past");
                }
                else if (diff < 0) {
                    // dim if appointment has recently passed
                    button.addClass("appointment-cell-recent-past");
                }
                else if (diff < 60) {
                    // appointments in the next hour should be wider
                    button.addClass("appointment-cell-near-future");
                }
                else {
                    // all others
                    button.addClass("appointment-cell-future");
                }

            });
        }
        
        if (firstTime) {
            this.scrollToNow(0);
        }
    }
};

class StudentControls {
    private static _name = "StudentControls";

    private queue: AppointmentsQueue;

    private elem: JQuery;
    private signUpForm: SignUpForm<true>;

    public readonly _act! : MessageResponses;

    constructor(queue: AppointmentsQueue, elem: JQuery) {
        this.queue = queue;
        this.elem = elem;

        let formElem = $('<div></div>').appendTo(this.elem);
        this.signUpForm = new SignUpForm(formElem, true, this.queue.page.mapImageSrc);
        addListener(this.signUpForm, this);
    }

    public refreshSignUpEnabled() {
        var isEnabled = User.isUmich() && !this.queue.myRequest;
        this.signUpForm.setSignUpEnabled(isEnabled);
    }

    @messageResponse()
    private queueRefreshed() {
        this.refreshSignUpEnabled();
    }

    @messageResponse()
    private userSignedIn() {
        this.refreshSignUpEnabled();
    }

    public setMyAppointment() {
        this.signUpForm.setMyRequest(this.queue.myRequest);
    }

    public setAppointments(schedule: AppointmentSchedule) {
        this.signUpForm.setAppointments(schedule);
    }
    
    @messageResponse()
    private signUp(msg: Message<SignUpMessage>) {
        // if (!this.queue.myRequest) {
            this.queue.signUp(
                msg.data.signUpName,
                msg.data.signUpLocation,
                msg.data.signUpDescription,
                msg.data.mapX,
                msg.data.mapY,
                msg.data.timeslot);
        // }
        // else {
            // this.queue.updateRequest(
            //     msg.data.signUpName,
            //     msg.data.signUpLocation,
            //     msg.data.signUpDescription,
            //     msg.data.mapX,
            //     msg.data.mapY,
            //     msg.data.timeslot);
        // }
    }
    
    @messageResponse()
    private removeRequest(msg: Message<Appointment>) {
        this.queue.removeAppointment(msg.data);
    }
    
}
function createAppointment(appData: any, startOfDay: moment.Moment) {
    return <Appointment>{
        kind: "appointment",
        id: parseInt(appData["id"]),
        queueId: parseInt(appData["queueId"]),
        timeslot: parseInt(appData["timeslot"]),
        scheduledDate: appData["scheduledDate"],
        duration: parseInt(appData["duration"]),
        scheduledTime: startOfDay.clone().add(appData["timeslot"] * parseInt(appData["duration"]), 'm'),
        studentEmail: appData["studentEmail"],
        staffEmail: appData["staffEmail"],
        name: appData["name"],
        location: appData["location"],
        description: appData["description"],
        mapX: appData["mapX"],
        mapY: appData["mapY"]
    };
}

