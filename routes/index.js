exports.index = function(req,res) {
	res.render('index.html');
}

exports.one = function(req,res){
	res.render('one.html');
	
}

exports.one_chat = function(req,res){
	//var values = {};
	//values.nick =
	//console.log(req.body.userName);
	var data = {};
	data.nick = req.body.nick;
	data.roomKey = req.body.roomKey;
	/*if(nick===''){
		data.message= "Please provide us with your nick, try again!!";
		res.render('error.html',data);
	}*/
	console.log(data.nick);
	console.log(data.roomKey);
	res.render('one_interface.html',data);
	
}

exports.group = function(req,res){
	res.render('group.html');
}

exports.lecture = function(req,res){
	res.render('lecture.html');
}

exports.lecture_host = function(req,res){
	//var values = {};
	//values.nick =
	//console.log(req.body.userName);
	var data = {};
	data.nick = req.body.nick;
	data.lectureKey = req.body.lectureKey;
	/*if(nick===''){
		data.message= "Please provide us with your nick, try again!!";
		res.render('error.html',data);
	}*/
	console.log(data.nick);
	console.log(data.lectureKey);
	res.render('lecture_host.html',data);
	
}

exports.lecture_client = function(req,res){
	//var values = {};
	//values.nick =
	//console.log(req.body.userName);
	var data = {};
	data.nick = req.body.nick;
	data.lectureKey = req.body.lectureKey;
	/*if(nick===''){
		data.message= "Please provide us with your nick, try again!!";
		res.render('error.html',data);
	}*/
	console.log(data.nick);
	console.log(data.lectureKey);
	res.render('lecture_client.html',data);
	
}