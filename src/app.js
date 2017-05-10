var express = require('express');
var nodemailer = require('nodemailer');
var crypto = require('crypto');
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false })
var path = require('path'),
    //errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    mongoose = require('mongoose'),
    passport = require('passport'),
    https = require("https"),
    request = require('request'),
    fs = require('fs'),
    //User = mongoose.model('User'),
    parseString = require('xml2js').parseString;

var app = express();

app.get('/', function (req, res) {
	res.sendFile(__dirname + "/index.html");
})
/*
app.get('/success', function (req, res) {
	res.send("LAMOOOO DET GICK GOOD!!");
})*/

app.post('/nedo', urlencodedParser, function (req, res) {
	console.log(req.body.personalnumber);
	//var personalNumber = "197208263751";
	var personalNumber = req.body.personalnumber;
	var myXMLText = '<?xml version="1.0" encoding="utf-8"?>' +
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://bankid.com/RpService/v4.0.0/types/">' +
        '<soapenv:Header/>' +
        '<soapenv:Body> ' +
        '<typ:AuthenticateRequest> ' +
        '<!--Optional:--> ' +
        '<personalNumber>'+personalNumber+'</personalNumber> ' +
        '<!--0 to 20 repetitions:--> ' +
        '<endUserInfo> ' +
        '<type>IP_ADDR</type>  ' +
        '<value>127.0.0.1</value>  ' +         //Optional Parameters
        '</endUserInfo> ' +
        '<!--Optional:--> ' +
        '<requirementAlternatives> ' +
        '<!--0 to 7 repetitions:--> ' +
        '<requirement> ' +
        '<!--1 to 10 repetitions:--> ' +
        '<condition> ' +
        '<!--<key>?</key> -->  ' +
        '<!--1 to 20 repetitions:-->  ' +
        '<!--<value>?</value> -->  ' +
        '<key>CertificatePolicies</key> 	<!--The certificate policy must be --> ' +
        '<value>1.2.3.4.*</value>  	<!--1.2.752.1.5 (Mobile BankID) --> ' + //Currently set to test BankID -- Change in Production
        '</condition> ' +
        '</requirement> ' +

        '<requirement>  ' +
        '<condition>  ' +
        '<key>AllowFingerprint</key> 	<!--// TouchID --> ' +
        '<value>no</value> 			<!--is not allowed --> ' +
        '</condition>  ' +
        '</requirement> ' +
        '</requirementAlternatives> ' +
        '</typ:AuthenticateRequest> ' +
        '</soapenv:Body> ' +
        '</soapenv:Envelope>';

    var resJson = "";
    var autoStartToken = "";
    var orderRef = "";
    var faultString = "";
    var intervalid;
    
    request({
        url: "https://appapi.test.bankid.com/rp/v4",
        host: "appapi.test.bankid.com",
        rejectUnauthorized: false,
        requestCert: true,
        method: "POST",
        headers: {
            "content-type": "application/xml",  // <--Very important!!!
            //'Accept-Encoding': "gzip,deflate",
            'Content-Length': Buffer.byteLength(myXMLText),
            //'User-Agent': 'Apache-HttpClient/4.1.1 (java 1.5)',
            'Connection': "Keep-Alive"
        },

        body: myXMLText,

        agentOptions: {
            pfx: fs.readFileSync('certificates/FPTestcert2_20150818_102329.pfx'),
            passphrase: 'qwerty123',
        },
    }, function(error, response, body) {
        //extracting orderRef from the bankId server response XML
        parseString(body, function(err, result) {
            resJson = JSON.stringify(result);

            var tempStr = "JSON.parse(resJson)";
            var indeces = Array('soap:Envelope','soap:Body',0,'ns2:AuthResponse',0);
            
            for (var i=0;i<indeces.length; i++)
                if(eval(tempStr+"['"+indeces[i]+"']"))
                    tempStr += "['"+indeces[i]+"']";
                else
                {
                    tempStr += "['soap:Fault'][0]";
                    faultString = eval(tempStr).faultstring[0];
                    break;
                }
                
            if(faultString !==""){
                console.log(faultString); //Repeort the user (client) about the fault
            }
            else
            {
            var theValue = eval(tempStr);
            autoStartToken = theValue.autoStartToken;
            orderRef = theValue.orderRef;
            //Ping the BankId server every 3 seconds, with orderRef to get the User Data
            intervalid = setInterval(function() {
                var myXMLTextOrderRef = '<?xml version="1.0" encoding="utf-8"?>' +
                    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://bankid.com/RpService/v4.0.0/types/">' +
                    '<soapenv:Header/>' +
                    '<soapenv:Body>' +
                    '<typ:orderRef>' + orderRef[0] + '</typ:orderRef>' +
                    '</soapenv:Body>' +
                    '</soapenv:Envelope>';
                request({
                    url: "https://appapi.test.bankid.com/rp/v4",
                    host: "appapi.test.bankid.com",
                    rejectUnauthorized: false,
                    requestCert: true,
                    method: "POST",
                    headers: {
                        "content-type": "application/xml",  // <--Very important!!!
                        //'Accept-Encoding': "gzip,deflate",
                        'Content-Length': Buffer.byteLength(myXMLTextOrderRef),
                        //'User-Agent': 'Apache-HttpClient/4.1.1 (java 1.5)',
                        'Connection': "Keep-Alive"
                    },

                    body: myXMLTextOrderRef,
                    agentOptions: {
                        pfx: fs.readFileSync('certificates/FPTestcert2_20150818_102329.pfx'),
                        passphrase: 'qwerty123',
                    },


                }, function(error, response, body) {
                    if (!error) {
                        parseString(body, function(err, result) {
                            var resp = JSON.stringify(result);
                            var tempStrnew = "JSON.parse(resp)";
                            var indecesNew = Array('soap:Envelope','soap:Body',0,'ns2:CollectResponse',0);
                            var statusCod = "";
                            var faultStringRes = "";
                            
                            for (var i=0;i<indecesNew.length; i++)
                                if(eval(tempStrnew+"['"+indecesNew[i]+"']"))
                                    tempStrnew += "['"+indecesNew[i]+"']";
                                else
                                {
                                    tempStrnew += "['soap:Fault'][0]";
                                    faultStringRes = eval(tempStrnew).faultstring[0];
                                    break;
                                }
                            if(faultStringRes !== "")
                            {
                                console.log(faultStringRes); //Inform the client about this fault too!
                                clearInterval(intervalid);
                            	console.log("Fel")
                            	console.log("faultStringRes");
                                res.send("Authentication canceled");
                                clearInterval(intervalid);
                                return;
                            }
                            else {
                            	console.log("Inget fel")
                            }

                            statusCod = eval(tempStrnew).progressStatus[0];

                            console.log("Hejsan!")
                            if (statusCod === "OUTSTANDING_TRANSACTION") {
                            	console.log("Adrian är sämst på att köra bil");
                            } 
                            if (statusCod === "NO_CLIENT") {
                                res.send("You don't have the BankID client installed...");
                                clearInterval(intervalid);

                            }
                            if (statusCod === "USER_CANCEL") {
                            	console.log("C=3");
                                res.send("Authentication canceled");
                                clearInterval(intervalid);

                            }  
                            if (statusCod === "COMPLETE") {
                                var providerUserProfile = 
                                {
                                    firstName: eval(tempStrnew)['userInfo'][0].givenName[0],
                                    lastName: eval(tempStrnew)['userInfo'][0].surname[0],
                                };
                                clearInterval(intervalid);
                                res.send(providerUserProfile.firstName + " " + providerUserProfile.lastName + " has used BankID!!!");
                                return;
                            } 
                            	console.log(statusCod);
                            	//res.send(statusCod);
                                //clearInterval(intervalid);

                        });
                        }
                    });
                }, 3000);
            }
        });
    });
})

app.listen(8080, function () {
	console.log('Server listening on port 8080')
})
