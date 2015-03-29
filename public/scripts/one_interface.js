//getting access to user media devices
navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

//selectng html elements.
var localVideo = document.querySelector('#local');
var remoteVideo = document.querySelector('#remote');
var sendButton = document.getElementById("send");
var sendTextarea = document.getElementById("localText");
var messages = document.getElementById("messages");
//var receiveTextarea = document.getElementById("remoteText");

//variabe declarations
var nick = document.getElementById("nick").innerHTML;
var peerNick;
var room = document.getElementById("roomKey").innerHTML;
var isInitiator = false;
var isChannelReady = false;
var from =0;
var to =1;
var pc;
var sendChannel, receiveChannel, localStream;
var localAudioToggle = true;
var localVideoToggle = true;
//constraint definitions
var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'}]} : // IP address
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};

var pc_constraints = {
  'optional': [
    {'DtlsSrtpKeyAgreement': true}
  ]};

var sdpConstraints = {};

var constraints = {video: true, audio: true};

//socket to the server
var socket = io.connect("http://192.168.102.50:3000");

function initialize() {
    //console.log(nick);
    copyKey();
    socket.emit('create or join', room,nick);
}

sendButton.onclick = sendData;

document.getElementById("localText").onkeydown  = function(event) {
    if(event.keyCode === 13)
    sendData();
}

window.onbeforeunload = function(e){
        hangup();
}

function sendMessage(message){
  console.log('Sending message: ', message);
  socket.emit('message', message,from,to,room);
}

function handleUserMedia(stream) {
        localStream = stream;
        attachMediaStream(localVideo, stream);
        console.log('Adding local stream.');
        if(!isInitiator)
        sendMessage('got user media',from,to,room);
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
        sendMessage("mutedAudio");
    } else {
        localStream.getAudioTracks()[0].enabled = true;
        localAudioToggle = true;
        document.getElementById("muteAudioButton").innerHTML = "Mute Audio";
        console.log("Audio UnMuted");
        sendMessage("unmutedAudio");
        document.getElementById("localLabelAudio").innerHTML = "";
    }
}

function toggleVideo() {
    if(localVideoToggle){
        localStream.getVideoTracks()[0].enabled = false;
        localVideoToggle = false;
        document.getElementById("muteVideoButton").innerHTML = "UnMute Video";
        console.log("Video Muted");
        sendMessage("mutedVideo");
        document.getElementById("localLabelVideo").innerHTML = "Your video has been muted.";
    } else {
        localStream.getVideoTracks()[0].enabled = true;
        localVideoToggle = true;
        sendMessage("unmutedVideo");
        document.getElementById("muteVideoButton").innerHTML = "Mute Video";
        document.getElementById("localLabelVideo").innerHTML = "";
        console.log("Video Unmuetd");
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

socket.on('created', function (room){
  console.log('Created room ' + room);
  isInitiator = true;
  from = 0;
  to = 1;
  navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
  console.log('Getting user media with constraints', constraints);
});

socket.on('joined', function (room, peernick){
    console.log("Joined room" + room);
    peerNick = peernick;
    isChannelReady = true;
    from = 1;
    to = 0;
    navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
    console.log('Getting user media with constraints', constraints);
});

socket.on('roomFull', function (room) {
    alert("room full");
});

socket.on('peerJoined', function (room, peernick) {
    console.log("Peer Joined in");
    isChannelReady = true;
    peerNick = peernick;
});

socket.on('message', function ( message , sender){
  console.log('Received message:', message);
  if (message === 'got user media') {
        console.log("got user media from peer");
      checkAndStart();
  } else if (message.type === 'offer') {
    if (!isInitiator) {
      checkAndStart();
    }
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
  } else if (message === 'mutedAudio') {
    document.getElementById("remoteLabelAudio").innerHTML = "Peer client muted his audio.";
  } else if (message === 'mutedVideo') {
    document.getElementById("remoteLabelVideo").innerHTML = "Peer client muted his video.";
  } else if (message === 'unmutedAudio') {
    document.getElementById("remoteLabelAudio").innerHTML = "";
  } else if (message === 'unmutedVideo') {
    document.getElementById("remoteLabelVideo").innerHTML = "";
  }
});

function checkAndStart() {
    console.log("check and start called");
  if ( typeof localStream != 'undefined' && isChannelReady) {
        createPeerConnection();
        console.log("peer connection type formed");
    if (isInitiator) {
      doCall();
    }
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

  if (isInitiator) {
    try {
      // Create a reliable data channel
      sendChannel = pc.createDataChannel("sendDataChannel",
        {reliable: true});
      trace('Created send data channel');
    } catch (e) {
      alert('Failed to create data channel. ');
      trace('createDataChannel() failed with exception: ' + e.message);
    }
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onmessage = handleMessage;
    sendChannel.onclose = handleSendChannelStateChange;
  } else { // Joiner
    pc.ondatachannel = gotReceiveChannel;
  }

}

function sendData() {
  var data = sendTextarea.value;
  sendTextarea.value='';
  messages.innerHTML = messages.innerHTML + "<strong>"+nick+ ": </strong>" +data+"<br/>";
  messages.scrollTop = messages.scrollHeight;
  if(isInitiator) sendChannel.send(data);
  else receiveChannel.send(data);
  trace('Sent data: ' + data);
}

// Handlers...

function gotReceiveChannel(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event) {
    messages.innerHTML = messages.innerHTML + "<strong>"+peerNick+ ": </strong>" +event.data+"<br/>";
    messages.scrollTop = messages.scrollHeight;
    //messages.scrollTop($("#messages")[0].scrollHeight);
  //trace('Received message: ' + event.data);
  //receiveTextarea.value += event.data + '\n';
}

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
    localText.disabled = false;
    localText.placeholder = "";
    sendButton.disabled = false;
  }
}

function handleReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  trace('Receive channel state is: ' + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
            localText.disabled = false;
            localText.placeholder = "";
            sendButton.disabled = false;
          }
}


function handleIceCandidate(event) {
  console.log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate},from,to, room);
  } else {
    console.log('End of candidates.');
  }
}

// Create Offer
function doCall() {
  console.log('Creating Offer...');
  pc.createOffer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
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
  sendMessage(sessionDescription,from,to,room);
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
  isInitiator = false;
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