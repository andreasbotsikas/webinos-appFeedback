/**
 * Created with IntelliJ IDEA.
 * User: Abot
 * Date: 20/2/2013
 * Time: 3:21 μμ
 * To change this template use File | Settings | File Templates.
 */

// We will keep this app simple, so we will use vars and functions only
// The selected app which we are evaluating
var SelectedAppId = 1;

// Called when mandling with the options menu
function SelectedAppChanged(){
    SelectedAppId = $('input[name=application]:checked', '#ApplicationSelection').val();
    FixHeaderForSelection();
};

function GetResultForQuestion(questionNo){
    return $('input[name=star' + questionNo + ']:checked', '#Questions').val();
};

// Fixes the questionnaire header based on the selected app id
function FixHeaderForSelection(){
    var headerText = "";
    if (SelectedAppId==1)
        headerText = "webinos Connected Car";
    else if(SelectedAppId==2)
        headerText = "webinos Connected TV";
    else if(SelectedAppId==3)
        headerText = "webinos Connected Sensors";
    else if(SelectedAppId==4)
        headerText = "webinos Party Player";
    else if(SelectedAppId==5)
        headerText = "webinos Cross Device Payment";
    else if(SelectedAppId==6)
        headerText = "webinos Shopping and NFC";
    else if(SelectedAppId==7)
        headerText = "webinos Creative Notes";
    else if(SelectedAppId==8)
        headerText = "webinos Emergency Warning";
    else if(SelectedAppId==9)
        headerText = "webinos File Share";
    $("#applicationName").text(headerText);
};

function ResetForm(){
    for (var questionNo = 1; questionNo<=5;questionNo++){
        $('input[name=star' + questionNo +']', '#Questions').rating('select',null);
    }
    $('#feedback').val('');
};

function SaveVotes(){
    var saveString = '|AppId:' + SelectedAppId;
    for (var questionNo = 1; questionNo<=5;questionNo++){
        var result = GetResultForQuestion(questionNo);
        if (result!=null)
            saveString += '|' + result;
        else
            saveString += '|-'
    }
    saveString += '|' + $('#feedback').val();
    localStorage["survey_"+Date.now()]=saveString;
};

function showVotes(){
        var sc=0;
        if(localStorage){
            $("#ResultsDiv").html("");
            for(var i in localStorage){
                if(i.indexOf("survey_")===0){
                    $("#ResultsDiv").append("<li>"+(new Date(parseInt(i.split("survey_")[1])))+": "+localStorage[i]+"</li>");
                    sc++;
                }
            }
            $("#ResultsDiv").append((sc)?"<li></li>":"<li>no saved surveys.</li>");
        }
};

var myPzp = null; // Store local pzp name
var fileAPI =null;
var saveRoot = null;
var errorsLoadingAPI = null;

// Binds the local File API
function findFileAPI(){
    webinos.ServiceDiscovery.findServices(
        new ServiceType('http://webinos.org/api/file'),
        {
            onFound:function (service) {
                // If this is the local filesystem
                if (service.serviceAddress == myPzp){
                    // Bind the service
                    service.bindService({
                        onBind: function (service){
                            service.requestFileSystem(1, 0, function (filesystem) {
                                fileAPI = service;
                                saveRoot = filesystem.root; // We keep a reference to the root dir
                            });
                        }
                    });
                }
            },
            onError:function (error) {
                errorsLoadingAPI = error;
            }
        }
    );
};

function fileAPIError(error){
    $("#ApiLog").html(error);
};

function SaveVotesToDisk(){
    // Currently file api doesn't save the blob. We will use the external server instead.
    PostToServer();
    return;
    $("#ApiLog").html("Saving");
    if (saveRoot!=null){
    saveRoot.getDirectory('/MWCVotes', {
        create: true, // Create folder if doesn't exists
        exclusive: false
    }, function (entry) { //Success callback
        var name = 'MWCResults_' + new Date().getTime() + '.txt';
        entry.getFile(name, {
            create: true,
            exclusive: false
        }, function (entry) { //success Callback
            entry.createWriter(function (writer) {
                var written = false;
                var output = '';
                for(var i in localStorage){
                    if(i.indexOf("survey_")===0){
                        output += '' + parseInt(i.split("survey_")[1])+localStorage[i] + "\n";
                    }
                }
                writer.onerror = fileAPIError;
                writer.onwrite = function (evt) {
                    $("#ApiLog").html("Save done");
                    console.log("File save");
                    // Delete keys
                    for(var i in localStorage){
                        if(i.indexOf("survey_")===0){
                            localStorage.removeItem(i);
                        }
                    }
                    showVotes();
                };
                writer.write(new Blob([output]));
            }, fileAPIError);
        }, fileAPIError);
    },fileAPIError);
    }else{
        fileAPIError("Filesystem not initialized");
    }
};

function PostToServer(){
    var output = '';
    for(var i in localStorage){
        if(i.indexOf("survey_")===0){
            output += '' + parseInt(i.split("survey_")[1])+localStorage[i] + "\n";
        }
    }
    $("#ApiLog").html("Posting to server");
    $.ajax({
        type: "POST",
        url: 'http://mwcvotes.epu.ntua.gr/Home/Votes',
        data: {input: output},
        success: function(obj){
            if (obj!=null && obj.result != undefined)
              if (obj.result){
                $("#ApiLog").html("posted to server");
                  // Delete keys
                  for(var i in localStorage){
                      if(i.indexOf("survey_")===0){
                          localStorage.removeItem(i);
                      }
                  }
                  showVotes();
              }
              else
                $("#ApiLog").html("Server failed to save. Contact admin!");
        },
        error: function(err){
            $("#ApiLog").html("Network error");
        }
    });
};

function checkFileAPI(){
    if (myPzp== null)
        $("#ApiLog").html("webinos not initialized");
    else{
        if (fileAPI!=null){
            $("#ApiLog").html("Ready to save");
        }else{
            $("#ApiLog").html(errorsLoadingAPI);
        }
    }
};


function initializeWebinos(){
    // Wait for webinos to initialize
    webinos.session.addListener('registeredBrowser', function (data) {
        // If we haven't recieved this event before
        if (myPzp==null){
            myPzp = data.from;
            findFileAPI();
            checkFileAPI();
        }
    });
    //TODO: Perhaps we should be reading the info from the already loaded webinos.
    if(webinos.session.getSessionId()!=null){ //If the webinos has already started, force the registerBrowser event
        webinos.session.message_send({type: 'prop', payload: {status:'registerBrowser'}});
    }
};

function loadWebinosScript(){
    if(window.WebSocket || window.MozWebSocket)
    {
        console.log("==============================\nNative websocket found.\n==============================");
        $.getScript("./webinos.js", initializeWebinos);
    }
    else
    {
        if(typeof WebinosSocket == 'undefined')
        {
            console.log("==============================\nWebinosSocket is undefined!\n==============================");
            setTimeout(loadWebinosScript, 500);
        }
        else
        {
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\nWebinosSocket is defined!\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
            $.getScript("./webinos.js", initializeWebinos);
        }
    }

};

$(function () {
    // Set the questions as the first page
    document.location.hash = "#Questions";
    FixHeaderForSelection();

    $("input[name=application]").click(SelectedAppChanged);

    $("#cmdSubmit").click(SaveVotes);

    $("#cmdSaveToDisk").click(SaveVotesToDisk);
    $("#cmdPlanB").click(PostToServer);

    $("#cmdResetForm").click(ResetForm);
    $("#cmdResetForm1").click(ResetForm);
    $("#cmdResetForm2").click(ResetForm);
    // Refresh results when entering the page
    $(document).bind('pageshow', function (e) {
        if (e.target.id == "ShowResults") {
            showVotes();
            checkFileAPI();
        }
    });

    // Webinos socket initialized after 3 seconds. So we inject the script then
    loadWebinosScript();
});