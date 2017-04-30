"use strict";

var http = require('http');
var redis = require('redis');
var azure = require('azure');
var fs = require('fs');
var moment = require('moment');


http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'application/json'});
  getResults(function(err, results) {
    var obj;
    if (err) {
      obj = { error: err };
    }
    else {
      obj = results;
    }
    res.end(JSON.stringify(obj, null, " "));
  });
}).listen(3000, "127.0.0.1");
console.log('Server running at http://127.0.0.1:3000/');

var rclient = redis.createClient({host: 'spredis'});
rclient.on("error", function(err) {
  console.log("Redis error " + err);
});

var log = function() {
  console.log(...arguments);
}

var config = require('./config');
log("Config: ", config);
var sbservice = azure.createServiceBusService(config.sb_namespace,
                                              config.sb_account_key,
                                              config.sb_issuer);

var askForNext = function() {
  log('asking for next message ..');
  sbservice.receiveSubscriptionMessage(config.sb_topic, 'sweetiepull', 
      {isPeekLock: true, timeoutIntervalInS:99999999999}, callback);
}

var callback = function(err, message) {
  if (err) {
    if (err == 'No messages to receive') {
      log(err);
      setTimeout(askForNext, 5000);
      return;
    }
    log("Error on subscription: ",err);
    setTimeout(askForNext, 60*1000);
    return;
  }
  try {
    log("incoming message", message);
    process(message);
    sbservice.deleteMessage(message, function(err, response) {
      // not sure what to do on error here?
    });
    log("processed message");
  }
  catch (e) {
    log("failed to process message", e);
    // we failed to process the message, so mark it as unread
    sbservice.unlockMessage(message, function(err, response) {
      // not sure what could be done here
    });
  }
  askForNext();
}

askForNext();

var process = function(msg) { 
  var obj;
  try {
    obj = JSON.parse(msg.body);
  }
  catch (e) {
    log('could not parse: ',e);
    throw e;
  }

  if (obj.message) processMessage(obj);
  if (obj.deowl) processDeowl(obj);
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
  if (obj.message.indexOf("/me ") == 0) {
    rclient.lpush(mkKey(obj, 'tail'), '*** '+obj.speaker +' ' +obj.message.substring(4));
  }
  else {
    rclient.lpush(mkKey(obj, 'tail'), obj.speaker +': '+obj.message);
  }
  rclient.ltrim(mkKey(obj, 'tail'), 0, 30);

  var date = moment(obj.timestamp);

  // track count of messages
  rclient.incr(mkKey(obj, 'total'));

  // track count of lunabehs
  if (obj.message.match(/:lunabeh:/)) {
    rclient.incr(mkKey(obj, 'lunabehs'));
    rclient.hincrby(mkKey(obj, 'lunabehsBySpeaker'), obj.speaker, 1);
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

function processDeowl(obj) {

  var prefix = obj.success ? 'deowls' : 'deowlfails';

  rclient.hincrby(mkKey(obj, prefix), obj.speaker, 1);

}

var getResults = function(callback) {
 var obj = {room:'general', server:'conference.friendshipismagicsquad.com'};
 rclient.multi()
   .lrange(mkKey(obj,'tail'), 0, 99)
   .get(mkKey(obj, 'lunabehs'))
   .hgetall(mkKey(obj, 'lunabehsBySpeaker'))
   .hgetall(mkKey(obj, 'emotes'))
   .get(mkKey(obj, 'sweetreply'))
   .get(mkKey(obj, 'sweetping'))
   .hgetall(mkKey(obj, 'bySpeaker'))
   .hgetall(mkKey(obj, 'byHOD'))
   .get(mkKey(obj, 'total'))
   .hgetall(mkKey(obj, 'deowls'))
   .hgetall(mkKey(obj, 'deowlfails'))
   .exec(function(err, replies) {
     if (err) {
       callback(err);
     }
     else {
      var result = {
        tail: replies[0],
        lunabehs: replies[1],
        lunabehsBySpeaker: top(10, replies[2]),
        emotes: top(10, replies[3]),
        sweetreply: replies[4],
        sweetping: replies[5],
        bySpeaker: top(10, replies[6]),
        byHOD: replies[7],
        total: replies[8],
        deowls: top(10, replies[9]),
        deowlfails: top(10, replies[10]),
      };
      callback(false, result);
     }
   })
}

var top = function(num, dict) {
  var sortable = [];
  for (var item in dict) {
    sortable.push([item, dict[item]]);
  }
  sortable.sort(function(a, b) {return b[1] - a[1];});

  var result = {};
  for (var i=0; i<num; i++) {
    if (!sortable[i]) break;
    result[sortable[i][0]] = sortable[i][1];
  }

  return result;
}

