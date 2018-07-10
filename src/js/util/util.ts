
interface Array<T> {
    clear() : void;
} 
Array.prototype.clear = function () {
    this.length = 0;
}

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