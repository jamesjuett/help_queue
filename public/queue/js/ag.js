POLICIES = {
    "eecs280_public" : {
        "Return code correctness" : ["Expected and actual", "Expected and actual", "Hide", "Expected and actual"],
        "Stdout correctness" : ["Full diff", "Full diff", "Hide", "Full diff"],
        "Stderr correctness" : ["Full diff", "Full diff", "Hide", "Full diff"],
        "Command Visibility" : ["Show", "Show", "Show", "Show"],
        "Points" : ["Show", "Show", "Hide", "Show"],
        "Actual return code" : ["Show", "Show", "Hide", "Show"],
        "Actual stdout" : ["Show", "Show", "Hide", "Show"],
        "Actual stderr" : ["Show", "Show", "Hide", "Show"],
        "Timed out" : ["Show", "Show", "Hide", "Show"]
    },
    "eecs280_public_no_output" : {
        "Return code correctness" : ["Expected and actual", "Expected and actual", "Hide", "Expected and actual"],
        "Stdout correctness" : ["Hide", "Hide", "Hide", "Hide"],
        "Stderr correctness" : ["Hide", "Hide", "Hide", "Hide"],
        "Command Visibility" : ["Show", "Show", "Show", "Show"],
        "Points" : ["Show", "Show", "Hide", "Show"],
        "Actual return code" : ["Show", "Show", "Hide", "Show"],
        "Actual stdout" : ["Show", "Show", "Hide", "Show"],
        "Actual stderr" : ["Show", "Show", "Hide", "Show"],
        "Timed out" : ["Show", "Show", "Hide", "Show"]
    },
    "engr101_unit_test" : {
        "Return code correctness" : ["Expected and actual", "Expected and actual", "Hide", "Expected and actual"],
        "Stdout correctness" : ["Hide", "Hide", "Hide", "Hide"],
        "Stderr correctness" : ["Hide", "Hide", "Hide", "Hide"],
        "Command Visibility" : ["Show", "Show", "Show", "Show"],
        "Points" : ["Show", "Show", "Hide", "Show"],
        "Actual return code" : ["Hide", "Hide", "Hide", "Show"],
        "Actual stdout" : ["Hide", "Hide", "Hide", "Show"],
        "Actual stderr" : ["Hide", "Hide", "Hide", "Show"],
        "Timed out" : ["Show", "Show", "Hide", "Show"]
    },
    "eecs280_public_setup_compile" : {
        "Suite Visibility" : ["Show", "Show", "Show", "Show"],
        "Individual Tests" : ["Show", "Show", "Show", "Show"],
        "Setup/Teardown Exit Status" : ["Show", "Show", "Hide", "Show"],
        "Setup/Teardown Timeout" : ["Show", "Show", "Hide", "Show"],
        "Setup/Teardown Stdout" : ["Show", "Show", "Hide", "Show"],
        "Setup/Teardown Stderr" : ["Show", "Show", "Hide", "Show"]
    },
    "eecs280_private_setup_compile" : {
        "Suite Visibility" : ["Show", "Show", "Show", "Show"],
        "Individual Tests" : ["Show", "Show", "Show", "Show"],
        "Setup/Teardown Exit Status" : ["Show", "Show", "Hide", "Show"],
        "Setup/Teardown Timeout" : ["Show", "Show", "Hide", "Show"],
        "Setup/Teardown Stdout" : ["Hide", "Hide", "Hide", "Show"],
        "Setup/Teardown Stderr" : ["Hide", "Hide", "Hide", "Show"]
    }
};

var feedbackItemNotFound = function(feedbackItem){
    alert("uh oh... I couldn't find an item for " + feedbackItem);
};

OPTION_MAPPING = {
    "Full diff" : "expected_and_actual",
    "Expected and actual" : "expected_and_actual",
    "Correct/Incorrect" : "correct_or_incorrect",
    "Hide" : "no_feedback",

    "expected_and_actual" : "expected_and_actual",
    "correct_or_incorrect" : "correct_or_incorrect",
    "no_feedback" : "no_feedback"
};


var clickToDesiredOption = function(select, buttons, desiredOption) {
    var currentVal;
    var clickCount = 0;

    var clickToDesiredOption_impl = function() {
        if (select.val() != desiredOption) {
            if (clickCount == 0) {
                buttons.last().click();
            }

            if (select.val() != currentVal) {
                // value changed, so click again and try again
                currentVal = select.val();
                clickCount = 0;
                setTimeout(clickToDesiredOption_impl, 10);
            }
            else {
                // value did not change. wait unless clicked too many times already
                if (clickCount < 10) {
                    clickCount = clickCount + 1;
                    setTimeout(clickToDesiredOption_impl, 10);
                }
                else {
                    alert("Unable to change option to " + desiredOption);
                }
            }
        }
    };

    var clickToBeginning_impl = function() {
        buttons.first().click();
        if (clickCount < 10) {
            clickCount = clickCount + 1;
            setTimeout(clickToBeginning_impl, 10);
        }
        else {
            currentVal = select.val();
            clickCount = 0;
            setTimeout(clickToDesiredOption_impl, 10);
        }
    };

    setTimeout(clickToBeginning_impl, 10);
};

var applyOptionPolicy = function(row, policy) {
    for (var i = 0; i < policy.length; ++i) {
        var desiredOption = OPTION_MAPPING[policy[i]];
        var select = row.eq(i).find("select");
        var buttons = select.siblings("button");

        clickToDesiredOption(select, buttons, desiredOption);
    }
};

var applyShowHidePolicy = function(row, policy) {
    for (var i = 0; i < policy.length; ++i) {
        row.eq(i).find(".btn-default:contains('" + policy[i] + "')").last().click()
    }
};

POLICY_APPLY_FUNCS = {
    "Return code correctness" : applyOptionPolicy,
    "Stdout correctness" : applyOptionPolicy,
    "Stderr correctness" : applyOptionPolicy,

    "Command Visibility" : applyShowHidePolicy,
    "Points" : applyShowHidePolicy,
    "Actual return code" : applyShowHidePolicy,
    "Actual stdout" : applyShowHidePolicy,
    "Actual stderr" : applyShowHidePolicy,
    "Timed out" : applyShowHidePolicy,
    "Suite Visibility" : applyShowHidePolicy,
    "Individual Tests" : applyShowHidePolicy,
    "Setup/Teardown Exit Status" : applyShowHidePolicy,
    "Setup/Teardown Timeout" : applyShowHidePolicy,
    "Setup/Teardown Stdout" : applyShowHidePolicy,
    "Setup/Teardown Stderr" : applyShowHidePolicy,
};



var applyItemPolicy = function(feedbackItem, policy) {
    var row = $(":contains('" + feedbackItem + "')").last().closest("td").siblings();
    if (row.length > 0) {
        POLICY_APPLY_FUNCS[feedbackItem](row, policy);
    }
    else {
        feedbackItemNotFound(feedbackItem);
    }
};

var applyPolicy = function(policy) {
    for(var item in policy) {
        applyItemPolicy(item, policy[item]);
    }
};

var makeApplyPolicyFunction = function(policy) {
    return function(){
        setTimeout(function() {
            applyPolicy(policy);
        }, 0);
    };
};

var buttonBar = $('<div style="position: fixed; height: 40px; left:0; right:0; bottom:0"></div>');
$("body").append(buttonBar).css("padding-bottom", "40px");
for(var policy in POLICIES) {
    var button = $("<button>" + policy + "</button>");
    button.on("click", makeApplyPolicyFunction(POLICIES[policy]));
    buttonBar.append(button);
}