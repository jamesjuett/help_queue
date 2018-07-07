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
            QueueApplication.userSignedIn();
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
            return this.email.endsWith("@umich.edu");
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
                            QueueApplication.refreshActiveQueue();
                        }, 5000);

                        if (Notification) {
                            Notification.requestPermission();
                        }
                    }
                    else {
                        setInterval(function () {
                            QueueApplication.refreshActiveQueue();
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
              QueueApplication.refreshActiveQueue();
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
