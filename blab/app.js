
var express = require('express'),
	http = require('http'),
	ejs = require('ejs'),
	routes = require('./routes'),
	logger = require('morgan'),
	bodyParser = require('body-parser'),
	methodOverride = require('method-override');


var app = module.exports = express();

app.set('views', __dirname + '/views');
app.set('view options', {layout:false});
app.engine('html', ejs.renderFile);
//app.set('view engine', 'html');
app.use(logger('dev'));
app.use(bodyParser());
app.use(methodOverride());
app.use(express.static(__dirname + '/public'));

app.get('/', routes.index);
app.get('/one', routes.one);
app.post('/one-chat', routes.one_chat);
app.get('/group',routes.group);
app.get('/lecture',routes.lecture);
app.post('/lecture-host',routes.lecture_host);
app.post('/lecture-client',routes.lecture_client);
//app.get('/upload',routes.uploadUI);
//app.post('/upload',routes.upload);

var server = http.createServer(app).listen(3000, function() {
	console.log("Server running at port 3000");
});

var room = {};
var io = require('socket.io').listen(server);
io.sockets.on('connection', function (socket){
	//console.log("some user connected");

    socket.on('create or join', function (roomId,nick) {
        var clientId;
		if(room[roomId] == undefined || room[roomId].client[0] == undefined) {	// First user to enter the room
			room[roomId] = {client : [], nick: [], roomFull : 0};
			room[roomId].client[0] = socket;
			room[roomId].nick[0] = nick;
			clientId = 0;
			time = new Date();
			console.log("Initiator connected");
			socket.emit('created',roomId);
		}
		else {
			if(room[roomId].client.length != 2) {	// Second user to enter the room
				room[roomId].client[1] = socket;
				room[roomId].nick[1] = nick;
				clientId = 1;
				console.log("Peer connected");
				socket.emit('joined',roomId,room[roomId].nick[0]);
				room[roomId].client[0].emit('peerJoined', roomId, room[roomId].nick[1]);
			}
			else {	// 2 users already in the room
				room[roomId].roomFull = 1;
				socket.emit('roomFull',roomId);
				console.log("Room Full");
			}
		}
		if(!room[roomId].roomFull) {
			socket.emit('clientId',clientId);
		}
    });


socket.on('message', function (message,from,to,roomId) {
//        console.log('S --> got message: ', message);//
        // channel-only broadcast...
        //room[roomId].client[0].emit('message', message);
        
        console.log(from);
        console.log(to);
        console.log(roomId);
        room[roomId].client[to].emit('message', message,from);
        /*if(message === 'bye'){
        	console.log("got bye:" + message);
        	console.log("got bye on server");
        	delete room[roomId];
        }*/
        console.log(room);
        
    });

//lecture area

socket.on('create or join lecture', function (roomId,nick) {
        var clientId;
		if(room[roomId] == undefined || room[roomId].client[0] == undefined) {	// First user to enter the room
			room[roomId] = {client : [], nick: [], host: null, roomFull : 0};
			room[roomId].client[0] = socket;
			room[roomId].host = nick;
			clientId = 0;
			time = new Date();
			console.log("Host connected");
			socket.emit('createdLecture',roomId);
		}
		else {
			var nickId = room[roomId].client.length;
			if(nickId != 10) {	// Second user to enter the room
				room[roomId].client[nickId] = socket;
				room[roomId].nick[nickId -1] = nick;
				clientId = nickId;
				console.log("Lecture Peer connected");
				socket.emit('joinedLecture',roomId,room[roomId].nick,room[roomId].host);
				for(key in room[roomId].client )
				room[roomId].client[key].emit('peerJoinedLecture', roomId, room[roomId].nick[nickId-1]);
			}
			else {	// 2 users already in the room
				room[roomId].roomFull = 1;
				socket.emit('lectureRoomFull',roomId);
				console.log("Room Full");
			}
		}
		if(!room[roomId].roomFull) {
			socket.emit('clientId',clientId);
		}
    });


socket.on('lectureMessage', function (message,from,to,roomId) {
//        console.log('S --> got message: ', message);//
        // channel-only broadcast...
        //room[roomId].client[0].emit('message', message);
        
        //console.log(from);
        console.log(to);
        //console.log(roomId);
        if (to ==="host")
        	room[roomId].client[0].emit('lectureMessage', message,from);
        else if(to === "all"){
        	
        	var key;
        	for(key in room[roomId].client) {
        	console.log(key);
        	room[roomId].client[key].emit('lectureMessage', message,from);
        }
        	//room[roomId].client[].emit('', message,from);
        }
    	else {
    		console.log(room[roomId].nick.indexOf(to));
    		room[roomId].client[room[roomId].nick.indexOf(to)+1].emit('lectureMessage', message,from);
    	}
        /*if(message === 'bye'){
        	console.log("got bye:" + message);
        	console.log("got bye on server");
        	delete room[roomId];
        }*/
        console.log(room);
        
    });

});

