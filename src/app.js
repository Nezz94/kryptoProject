var express = require('express')
var app = express()

app.get('/', function (req, res) {
	res.send('Jojacocibobi')
})

app.get('/nedo', function (req, res) {
	console.log(req)
	res.send('Nedo')
})

app.listen(8080, function () {
	console.log('Server listening on port 8080')
})
