"use strict";

var http = require('http');
var redis = require('redis');
var azure = require('azure');
var fs = require('fs');
var moment = require('moment');


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

var askForNext = function() {
  log('asking for next message ..');
  sbservice.receiveSubscriptionMessage('chat-general', 'sweetiepull', 
      {timeoutIntervalInS:99999999999}, callback);
}

var callback = function(err, message) {
  if (err) {
    if (err == 'No messages to receive') {
      log(err);
      setTimeout(function() {
        askForNext();
      }, 5000);
      return;
    }
    log("Error on subscription: "+err);
    throw err;
    return;
  }

  log(message);
  process(message);
  askForNext();
}

askForNext();

var process = function(msg) { 
  var obj;
  try {
    obj = JSON.parse(msg.body);
  }
  catch (e) {
    log('could not parse: '+e);
    return;
  }

  processMessage(obj);
}

var mkKey = function(obj, postfix) {
  return obj.server +':'+obj.room+':'+postfix;
}

var processMessage = function(obj) {

  if (!obj.room || !obj.speaker || !obj.message || !obj.timestamp || !obj.server) {
    log('processMessage: some properties not found, discarding');
    return;
  }

  if (obj.speaker.length == 0) {
    log('processMessage: ignoring string with no length');
    return;
  }

  // track the last n messages
  rclient.lpush(mkKey(obj, 'tail'), obj.speaker +': '+obj.message);
  rclient.ltrim(mkKey(obj, 'tail'), 0, 30);

  var date = moment(obj.timestamp);

  // track count of messages
  rclient.incr(mkKey(obj, 'total'));

  // track count of lunabehs
  if (obj.message.match(/:lunabeh:/)) {
    rclient.incr(mkKey(obj, 'lunabehs'));
  }

  // track popularity of emotes
  (obj.message.match(/:[a-z0-9]+:/g) || []).forEach(function(emote) {
    rclient.hincrby(mkKey(obj, 'emotes'), emote, 1);
  });

  // track count of sweetiebutt replies
  if (obj.speaker.match(/^sweetieb/i)) {
    rclient.incr(mkKey(obj, 'sweetreply'));
  }

  // track count of sweetiebutt pings
  if (obj.message.match(/sweetiebutt/i) || obj.message.match(/sweetiebot/i)) {
    rclient.incr(mkKey(obj, 'sweetping'));
  }

  // track count per author
  rclient.hincrby(mkKey(obj, 'bySpeaker'), obj.speaker, 1);

  // track number of messages per day
  rclient.hincrby(mkKey(obj, 'byDay'), date.format('YYYYMMDD'), 1);

  // track number of messages per day of week
  rclient.hincrby(mkKey(obj, 'byDOW'), date.day(), 1);

  // track number of messages per hour of day
  rclient.hincrby(mkKey(obj, 'byHOD'), date.hour(), 1);
}
