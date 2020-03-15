import { Page } from "./Queue";
import { Course, QueueApplication } from "./QueueApplication";
import { oops, showErrorMessage } from "./util/util";

export class AppointmentsQueue {

    public readonly page: Page;

    // public readonly myRequest: QueueEntry | null = null;

    // private readonly adminControlsElem: JQuery;
    // private readonly studentControlsElem: JQuery;
    private readonly appointmentsElem: JQuery;
    // private readonly stackElem: JQuery;

    // private readonly adminControls: AdminControls;
    // private readonly studentControls: StudentControls;



    constructor(data: {[index:string]: any}, page: Page, elem: JQuery) {
        this.page = page;

        this.appointmentsElem = $("<p>hello there</p>").appendTo(elem);


        // this.adminControlsElem = $('<div class="panel panel-default adminOnly"><div class="panel-body"></div></div>')
        //     .appendTo(this.elem)
        //     .find(".panel-body");

        // this.adminControls = new AdminControls(this, this.adminControlsElem);

        // this.studentControlsElem = $('<div class="panel panel-default"><div class="panel-body"></div></div>')
        //     .appendTo(this.elem)
        //     .find(".panel-body");

        // this.studentControls = new StudentControls(this, this.studentControlsElem);
        // this.observable.addListener(this.studentControls);

    }

    
    // $.getJSON(`api/queues/${this.queueId}/appointments/0`).then((a) => console.log(JSON.stringify(a, null, 4)));
    // $.getJSON(`api/queues/${this.queueId}/appointmentsSchedule`).then((a) => console.log(JSON.stringify(a, null, 4)));
    
    public refreshRequest() {
        return $.ajax({
            type: "GET",
            url: `api/queues/${this.page.queueId}/appointments/0`,
            data: {},
            dataType: "json"
        });
    }

    public refreshResponse(data : {[index: string]: any}) {

        console.log(JSON.stringify(data));
        this.appointmentsElem.html(JSON.stringify(data));

        // let queue = data["queue"];

        // this.page.setNumEntries(this.numEntries);
    }

    public clear() {
        // Do nothing
    }

    // public signUp(name: string, location: string, description: string, mapX?: number, mapY?: number) {
    //     return $.ajax({
    //         type: "POST",
    //         url: "api/signUp",
    //         data: {
    //             idtoken: User.idToken(),
    //             queueId: this.queueId,
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
}