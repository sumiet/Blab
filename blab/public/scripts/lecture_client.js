//getting access to user media devices
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

//selectng html elements.
var localVideo = document.querySelector('#local');
var remoteVideo = document.querySelector('#remote');
var sendButton = document.getElementById("send");
var sendTextarea = document.getElementById("localText");
var messages = document.getElementById("messages");
var peerList = document.getElementById("peerList");
//var receiveTextarea = document.getElementById("remoteText");

//variabe declarations
var nick = document.getElementById("nick").innerHTML;
var peerNick = [];
var room = document.getElementById("lectureKey").innerHTML;
var isChannelReady = false;
var pc;
var messageSender;
var sendChannel, receiveChannel, localStream;
var localAudioToggle = true;
//constraint definitions
var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'}]} : // IP address
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};

var pc_constraints = {
  'optional': [
    {'DtlsSrtpKeyAgreement': true}
  ]};

var sdpConstraints = {};

var constraints = {video: false, audio: true};

//socket to the server
var socket = io.connect("http://192.168.102.50:3000");

function initialize() {
    //console.log(nick);
    copyKey();
    socket.emit('create or join lecture', room,nick);
}

sendButton.onclick = sendData;

document.getElementById("localText").onkeydown  = function(event) {
    if(event.keyCode === 13)
    sendData();
}

window.onbeforeunload = function(e){
        hangup();
}

function sendMessage(message,from,to){
  console.log('Sending message: ', message);
  socket.emit('lectureMessage', message,from,to,room);
}

function handleUserMedia(stream) {
        localStream = stream;
        attachMediaStream(localVideo, stream);
        console.log('Adding local stream.');
        sendMessage('got user media',nick,"host");
}

function handleUserMediaError(error){
        console.log('navigator.getUserMedia error: ', error);
}

function toggleAudio() {
    if(localAudioToggle){
        localStream.getAudioTracks()[0].enabled = false;
        localAudioToggle = false;
        console.log("Audio Muted");
        document.getElementById("muteAudioButton").innerHTML = "UnMute Audio";
        document.getElementById("localLabelAudio").innerHTML = "Your audio has been muted.";
        sendMessage("mutedLectureAudio",nick,messageSender);
    } else {
        localStream.getAudioTracks()[0].enabled = true;
        localAudioToggle = true;
        document.getElementById("muteAudioButton").innerHTML = "Mute Audio";
        console.log("Audio UnMuted");
        sendMessage("unmutedLectureAudio",nick,messageSender);
        document.getElementById("localLabelAudio").innerHTML = "";
    }
}

function copyKey() {
    ZeroClipboard.setMoviePath("/plugins/zeroClipBoard/ZeroClipboard.swf");
    var clip = new ZeroClipboard.Client();
    clip.addEventListener('mousedown',function() {
        clip.setText(document.getElementById("chatKey").innerHTML);
    });
    clip.addEventListener('complete',function(client,text) {
        alert("Room key copied to clipboard. Share this unique key with the person you want to blaber with!!");
    });
    clip.glue('copyKey');
}

socket.on('joinedLecture', function (room, peernick, host){
    console.log("Joined room" + room);
    peerNick = peernick;
    console.log(peerNick);
    isChannelReady = true;
    navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
    peerList.innerHTML = peerList.innerHTML + "<div id='peerListEntry'> Host: " + host + "</div>";
    for(keys in peernick)
      if(peernick[keys]!=messageSender)
        peerList.innerHTML = peerList.innerHTML + "<div id='peerListEntry'>" + peernick[keys] + "</div>";
    console.log('Getting user media with constraints', constraints);

});

socket.on('peerJoinedLecture', function (peernick){
    if(nick!=peernick)
      peerList.innerHTML = peerList.innerHTML + "<div id='peerListEntry'>" + peernick + "</div>";
});

socket.on('lectureRoomFull', function (room) {
    alert("Lecture room full");
});


socket.on('lectureMessage', function ( message , sender){
  messageSender = sender;
  console.log('Received message:', message);
  if (message.type === 'offer') {
    console.log("offer");
    checkAndStart();
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer') {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' ) {
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.label,
      candidate:message.candidate});
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' ) {
    handleRemoteHangup();
  } else if (message === 'mutedLectureAudio') {
    if(nick!= messageSender)
    document.getElementById("remoteLabelAudio").innerHTML = "Peer client muted his audio.";
  } else if (message === 'mutedLectureVideo') {
    if(nick!= messageSender)
    document.getElementById("remoteLabelVideo").innerHTML = "Peer client muted his video.";
  } else if (message === 'unmutedLectureAudio') {
    if(nick!= messageSender)
    document.getElementById("remoteLabelAudio").innerHTML = "";
  } else if (message === 'unmutedLectureVideo') {
    if(nick!= messageSender)
    document.getElementById("remoteLabelVideo").innerHTML = "";
  } else if (message.type === "chat") {
    handleMessage(message.message);
  }
});

function checkAndStart() {
    console.log("check and start called");
  if ( typeof localStream != 'undefined' && isChannelReady) {
        createPeerConnection();
        console.log("peer connection type formed");
  }
}

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pc_config, pc_constraints);
    pc.addStream(localStream);
    pc.onicecandidate = handleIceCandidate;
    console.log("rtc peer made");
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
      return;
  }

  pc.onaddstream = handleRemoteStreamAdded;
  pc.onremovestream = handleRemoteStreamRemoved;
}

function sendData() {
  var data = sendTextarea.value;
  sendTextarea.value='';
  if(data != ''){
    messages.scrollTop = messages.scrollHeight;
    sendMessage({
        type:"chat",
        message:data},nick,"all");
    trace('Sent data: ' + data);
  }
}

// Handlers...
function handleMessage(message) {
    messages.innerHTML = messages.innerHTML + "<strong>"+messageSender+ ": </strong>" +message+"<br/>";
    messages.scrollTop = messages.scrollHeight;
}


function handleIceCandidate(event) {
  console.log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate},nick,messageSender);
  } else {
    console.log('End of candidates.');
  }
}


//error handler
function onSignalingError(error) {
        console.log('Failed to create signaling message : ' + error.name);
}

// Create Answer
function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

// Success handler for both createOffer()
// and createAnswer()
function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription,nick,messageSender);
}

// Remote stream handlers...

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  attachMediaStream(remoteVideo, event.stream);
  console.log('Remote stream attached!!.');
  remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

// Clean-up functions...

function hangup() {
  console.log('Hanging up.');
  stop();
  if(isChannelReady)
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isChannelReady = false;
  document.getElementById("remoteLabelVideo").innerHTML = "";
  document.getElementById("remoteLabelAudio").innerHTML = "";
  alert("Remote Client Hung Up");
}

function stop() {
  if (sendChannel) sendChannel.close();
  if (receiveChannel) receiveChannel.close();
  if (pc) pc.close();
  pc = null;
  sendButton.disabled=true;
}