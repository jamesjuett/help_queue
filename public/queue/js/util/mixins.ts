type Constructor<T> = new(...args: any[]) => T;

interface ObservableType {
    send(category: string, data: any) : void;
    addListener(listener: ObserverType, category?: string | string[]) : ObservableType;
    removeListener(listener: ObserverType, category?: string) : ObservableType;
    identify(category: string, func: (o:ObserverType) => any) : ObserverType;
}

interface ObserverType {
    _IDENTIFY(msg : {data:(o:any) => void}) : void;
    listenTo(other: ObservableType, category: string) : ObserverType;
    stopListeningTo(other: ObservableType, category: string) : ObserverType; 
    recv (msg : Message) : void;
}

interface Message {
    category: string,
    data: {},
    source: any // Could be observable type, but not sure that's really helpful
}

export interface Actor {
    _act : {
        [index: string]: ((msg: Message) => void)
    }
}

export function Observer<BaseType extends Constructor<Actor>>(Base: BaseType) {
    return class extends Base implements ObserverType {

        public _IDENTIFY(msg : {data:(o:any) => void}) {
            msg.data(this);
        }

        public listenTo(other: ObservableType, category: string) {
            other.addListener(this, category);
            return this;
        }

        public stopListeningTo(other: ObservableType, category: string) {
            if (other) {
                other.removeListener(this, category);
            }
            return this;
        }

        public recv (msg : Message) {

            // Call the "_act" function for this
            var catAct = this._act[msg.category];
            if (catAct){
                catAct.call(this, msg);
            }
            else if (this._act._default){
                this._act._default.call(this, msg);
            }
            else {
                assert(false);
            }
    
        }
    }
}

export function Observable<BaseType extends Constructor<Actor>>(Base: BaseType) {
    return class extends Base implements ObservableType{
        private universalObservers: ObserverType[] = [];
        private observers: {[index: string] : ObserverType[]} = {};
        private silent = false;

        public send(category: string, data: any) {
            if (this.silent){
                return;
            }
            
            let msg: Message = {
                category: category,
                data: data,
                source: this
            };
    
            var observers = this.observers[msg.category];
            if (observers) {
                for (var i = 0; i < observers.length; ++i) {
                    observers[i].recv(msg);
                }
            }

            for (var i = 0; i < this.universalObservers.length; ++i) {
                this.universalObservers[i].recv(msg);
            }
        }

        public addListener(listener: ObserverType, category?: string | string[]) {
            if (category) {
                if (Array.isArray(category)) {
                    // If there's an array of categories, add to all individually
                    for (var i = 0; i < category.length; ++i) {
                        this.addListener(listener, category[i]);
                    }
                }
                else {
                    if (!this.observers[category]) {
                        this.observers[category] = [];
                    }
                    this.observers[category].push(listener);
                    this.listenerAdded(listener, category);
                }
            }
            else{
                // if no category, intent is to listen to everything
                this.universalObservers.push(listener);
                this.listenerAdded(listener);
            }
            return this;
        }
    

        /*
        Note: to remove a universal listener, you must call this with category==false.
        If a listener is universal, removing it from a particular category won't do anything.
        */
        public removeListener(listener: ObserverType, category?: string) {
            if(category) {
                // Remove from the list for a specific category (if list exists)
                let observers = this.observers[category];
                observers && observers.remove(listener);
                this.listenerRemoved(listener, category);
            }
            else{
                // Remove from all categories
                for(var cat in this.observers){
                    this.removeListener(listener, cat);
                }

                // Also remove from universal listeners
                this.universalObservers.remove(listener);
                this.listenerRemoved(listener);
            }
            return this;
        }

        protected listenerAdded(listener: ObserverType, category?: string) : void { }
        protected listenerRemoved(listener: ObserverType, category?: string) : void { }

        public identify(category: string, func: (o:ObserverType) => any) {
            let other! : ObserverType; // Uses definite assignment annotation since the function is assumed to assign to other
            this.send(category, func || function(o:ObserverType) {other = o;});
            return other;
        }
    }

}
