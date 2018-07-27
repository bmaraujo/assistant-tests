const {google} = require('googleapis');
const request = require('request');

const PATH_TO_KEY = './TestProfiling-3b8cd8ccf75e.json';

const key = require(PATH_TO_KEY);

let jwtClient = new google.auth.JWT(
  key.client_email, null, key.private_key,
  ['https://www.googleapis.com/auth/actions.fulfillment.conversation'],
  null
);

jwtClient.authorize((err, tokens) => {
  // code to retrieve target userId and intent
  let notif = {
    userNotification: {
      title: 'Notificação de '+  new Date().toLocaleString(),
    },
    target: {
      userId: 'ABwppHH_tizaAkwXd34yvqk44Br2hPwFmwy5oLnZekhaClXAz_1E8wWTUeOztO4CsFRAuwj7fMHA3TbcorCZKkKUbA',
      intent: 'ultima dica',
      locale: 'pt-BR'
    },
  };

  console.log('token: ' + tokens.access_token);
  request.post('https://actions.googleapis.com/v2/conversations:send', {
    'auth': {
      'bearer': tokens.access_token,
     },
    'json': true,
    'body': {'customPushMessage': notif},
  }, (err, httpResponse, body) => {
     console.log(err);
     console.log(httpResponse.statusCode + ': ' + httpResponse.statusMessage);
     console.log(body);
  });
});

