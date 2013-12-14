"use strict";

var http = require('http');
var redis = require('redis');
var azure = require('azure');
var fs = require('fs');

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(3000, "127.0.0.1");
console.log('Server running at http://127.0.0.1:3000/');

var rclient = redis.createClient();
rclient.on("error", function(err) {
  console.log("Redis error " + err);
});

var sbAccountKey = fs.readFileSync('sb_account_key.txt', {encoding:'utf8'}).trim();
var sbservice = azure.createServiceBusService('jabber-fimsquad', sbAccountKey,
    'owner');

var log = function(msg) {
  console.log(msg);
}

log(sbAccountKey);
log(sbservice);

sbservice.receiveSubscriptionMessage('chat-general', 'sweetiepull', 
function(err, message) {
  if (err) {
    log("Error on subscription: "+err);
    throw err;
    return;
  }

  log(message);
  process(message);
});

var process = function(msg) { 
  var obj;
  try {
    obj = JSON.parse(msg.body);
  }
  catch (e) {
    log('could not parse: '+e);
    return;
  }

  if (!obj.room || !obj.speaker || !obj.message || !obj.timestamp) {
    log('some properties not found, discarding');
    return;
  }
}
