//Copyright 2013-2014 Amazon.com, Inc. or its affiliates. All Rights Reserved.
//Licensed under the Apache License, Version 2.0 (the "License"). 
//You may not use this file except in compliance with the License. 
//A copy of the License is located at
//
//    http://aws.amazon.com/apache2.0/
//
//or in the "license" file accompanying this file. This file is distributed 
//on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, 
//either express or implied. See the License for the specific language 
//governing permissions and limitations under the License.

//Get modules.
var express = require('express');
var routes = require('./routes');
var http = require('http');
var path = require('path');
var fs = require('fs');
var AWS = require('aws-sdk');
var app = express();

app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app.locals.theme = process.env.theme; //Make the THEME environment variable available to the app. 

//Read config values from a JSON file.
var config = fs.readFileSync('./app_config.json', 'utf8');
config = JSON.parse(config);

//Create DynamoDB client and pass in region.
var db = new AWS.DynamoDB({region: config.AWS_REGION});
//Create SNS client and pass in region.
var sns = new AWS.SNS({ region: config.AWS_REGION});

console.log(process.env);

//GET home page.
app.get('/', routes.index);

//POST signup form.
app.post('/signup', function(req, res) {
  var nameField = req.body.name,
      emailField = req.body.email,
      monkeyField = req.body.monkey,
      previewBool = req.body.previewAccess;
  res.send(200);
  signup(nameField, emailField, monkeyField, previewBool);
});

//Add signup form data to database.
var signup = function (nameSubmitted, emailSubmitted, monkeySubmitted, previewPreference) {
  var formData = {
    TableName: config.STARTUP_SIGNUP_TABLE,
    Item: {
      email: {'S': emailSubmitted}, 
      name: {'S': nameSubmitted},
      monkey: {'S': monkeySubmitted},
      preview: {'S': previewPreference}
    }
  };
  db.putItem(formData, function(err, data) {
    if (err) {
      console.log('Error adding item to database: ', err);
    } else {
      console.log('Form data added to database.');
      var snsMessage = 'New signup: %EMAIL%, likes %MONKEY%'; //Send SNS notification containing email from form.
      snsMessage = snsMessage.replace('%EMAIL%', formData.Item.email['S']);
      snsMessage = snsMessage.replace('%MONKEY%', formData.Item.monkey['S']);
      sns.publish({ TopicArn: config.NEW_SIGNUP_TOPIC, Message: snsMessage }, function(err, data) {
        if (err) {
          console.log('Error publishing SNS message: ' + err);
        } else {
          console.log('SNS message sent.');
        }
      });  
    }
  });
};

app.post('/getmap', function(req, res) {

  var scanObject = {
    TableName: config.CROSSCUT_SIMPLE_CELL_COUNTS,
  }

  db.scan(scanObject, function(err,data) {
    if (err) {
      console.log('Error getting new map data: ' + err);
      res.send('scan error getting map');
    } else {
      res.send(data);
    }
  })
});

//=============
//POST inquiry form.
var postCount = 0;
app.post('/inquiry', function(req, res) {
  postCount += 1;
  //res.send("Double quote data we are returning");
  res.send('c' + postCount);
});


// found on StackOverflow -- creates n-dimensional array as specified
function createArray(dimensions) {
    var arr = new Array(dimensions || 0),
        i = dimensions;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[dimensions-1 - i] = createArray.apply(this, args);
    }

    return arr;
}


// these should agree with client & bot.js definitions, see .../index.jade
var numRows = 10;
var numCols = 10;

var clickCounts = createArray(10,10);


// 55555 this should be obsolete-ifiable
//tic-tack-toe clicker
app.post('/clicker', function(req, res) {
  var row   = parseInt(req.body.row),
      col   = parseInt(req.body.col);
      color = req.body.color;

  clickCounts[row-1][col-1] += 1;

  var cellNum = numCols*(row-1) + col;  // should be 1-9 if all numerical
  var cellString = 'cell'+cellNum;

  var formData = {
    TableName: config.STARTUP_MAP_TABLE,
    Key: {
      'Customer ID': {'S': '0'}
    },
    AttributeUpdates: {},
    ReturnValues: "ALL_NEW"
  }
  
  // here's the kludge: create value for AttributeUpdates that includes cellString
  formData.AttributeUpdates[cellString] = {'Value': {'N': '1'},'Action':'ADD'};

  db.updateItem(formData, function(err, data) {
    if (err) {
      console.log('Error adding cell1 to database: ', err);
    } else {
    }
  });

  // update in CSCC table
  var countData = {
    TableName: config.CROSSCUT_SIMPLE_CELL_COUNTS,
    Key: {
      'cellnum': {'N': cellNum.toString()}
    },
    AttributeUpdates: {'ClickCount': {'Value': {'N': '1'},'Action': 'ADD'},
                       'Color': {'Value': {'S': color}, 'Action': 'PUT'}
                      },
    ReturnValues: "ALL_NEW"
  }

  db.updateItem(countData, function(err, data) {
    if (err) {
      console.log('Error adding CSCC to database: ', err);
    } else {
    }
  });

  // above, we're updating cumulative clicks in the DB (2 db tables, actually!)
  // for right now, we're also maintaining in-process in clickCounts, which is what we return to client

  res.send(clickCounts[row-1][col-1].toString());
});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
