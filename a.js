var request = require('request');

request.post(
    'https://sltv-pr.herokuapp.com/start/',
    { json: { key: 'value' } },
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
       
    }
);