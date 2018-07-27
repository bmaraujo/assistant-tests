'use strict';

const http = require('http');
const firebase = require('firebase');

var database;

var userName;

// Set the configuration for your app
var config = {
	apiKey: "AIzaSyAonUF_C100wtzju5CE2jL7Be8NpsndTUY",
	authDomain: "testprofiling-20d85.firebaseapp.com",
	databaseURL: "https://testprofiling-20d85.firebaseio.com/",
	storageBucket: "testprofiling-20d85.appspot.com"
};

function requestPermission (app) {
 		console.log('Pedindo permissão');
	 	app.askForPermission('Para lembrar de você', app.SupportedPermissions.NAME);
	}

class TestProfiling{

	constructor(app){

		let actionMap = new Map();

		actionMap.set('input.welcome', this.welcome.bind(this));
		actionMap.set('input.welcomep2', this.welcomeP2.bind(this));
		actionMap.set('signin', this.signIn);
		actionMap.set('handleSignin', this.handleSignin);
		actionMap.set('teste.chamaEvento', this.chamaEvento);
		actionMap.set('entregaCasa', this.entregaCasa);
		actionMap.set('handlePlace', this.handlePlace);
		actionMap.set('mostrarCard', this.mostrarCard);
		actionMap.set('pedirDica', this.fornecerDica);
		actionMap.set('finish.update.setup', this.finalizaSetupNotification);
		actionMap.set(app.StandardIntents.CONFIGURE_UPDATES, this.configureUpdates);

		app.handleRequest(actionMap);

	}

	configureUpdates(app){
		const intent = app.getArgument('UPDATE_INTENT');
		console.log('UPDATE_INTENT:' +  intent);
		app.askToRegisterDailyUpdate('falar_dica',
			[{name: "abc", textValue: "acc"}]);
	}

	fornecerDica(app){
		let resposta = 'A cada dez pessoas, a metade é cinco!';
		app.ask(app.buildRichResponse()
					.addSimpleResponse({ speech:resposta})
					.addSuggestions(['Me mande diariamente']));
	}

	finalizaSetupNotification(app){
		if (app.isUpdateRegistered()) {
			app.tell("Ok, você receberá updates diários.");
		} else {
			app.tell("Ok, você não receberá updates diários.");
		}
	}

	handlePlace(app){
		const place = app.getPlace();
		if (place) {
			app.tell(`Ah sim, ${place.address}. Vou mandar entregar lá.`);
		// Note that the client library uses address instead of formattedAddress as
		// shown in the example JSON
		} else {
			app.tell(`Opa, não conseguir pegar o local`);
		}
	}

	entregaCasa(app){
		app.askForPlace('Onde você quer que entregue?', 'Para mandar entregar');
	}

	chamaEvento(app){
		//chama_por_evento

		app.ask({
			speech : "Se deu este texto, falhou.",
			displayText : "Se deu este texto, falhou.",
			followupEvent:{
				name : "chama_por_evento",
				data : {}
			}
		});
	}

	mostrarCard(app){
		let texto = "Este é o card onde vai aparecer todo o texto do horóscopo que o assistente vai ler. Este texto vai aparecer dentro do card, mas não vai repetir fora dele, assim fica a impressão que o assistente está na verdade lendo o card, bacana né?";
		app.ask(app.buildRichResponse()
					.addSimpleResponse({ displayText: 'Aqui está:', speech:texto})
					.addSuggestions(['Sug1','Sug2','Sug3'])
					.addBasicCard(app.buildBasicCard(texto)
							.setTitle("Signo")
							.setImage('http://images.terra.com/2015/07/09/leao.png',"uma cara de leão")
							.addButton('Veja no site','http://www.terra.com.br')));
	}

	signIn(app){
		console.log('Asking for sign in');
		app.askForSignIn();
	}

	handleSignin(app){
		console.log('SignInStatus == ' + app.getSignInStatus());
		if (app.getSignInStatus() === app.SignInStatus.OK) {
		    let accessToken = app.getUser().accessToken;
		    // access account data with the token
		    app.tell('This is your accessToken:' + accessToken);
		  } else {
		    app.tell('You need to sign-in before using the app.');
		  }
	}

	welcome(app){
		let welcomePhrase = "";

		// firebase.initializeApp(config);

		// firebase.auth().signInWithEmailAndPassword('bruno.mourao.araujo@gmail.com','teste123').catch(function(error) {
		// 	// Handle Errors here.
		// 	var errorCode = error.code;
		// 	var errorMessage = error.message;

		// 	console.log('##### Error authenticating:' + errorCode + ' - ' + errorMessage);
		// });

		// console.log('-------- Firebase inicializado');

		// // Get a reference to the database service
		// database = firebase.database();

		// let userId = app.getUser().userId;

		// console.log('userId:' + userId);

		// database.ref('/users/' + userId).once('value').then(function(snapshot){
		// 	userName = (snapshot.val() && snapshot.val().name);
		// 	console.log('Dentro da função, name=' + userName);
		// 	if (userName) {
	 // 			welcomePhrase = "Bem vindo de volta $1!".replace("$1",userName);
	 // 		}
	 // 		else{
	 // 			requestPermission(app);
	 // 		}
	 // 		app.ask(welcomePhrase);
		// }); 		

		//teste de askForSignIn
		welcomePhrase = "Olá, sou o app de teste para tudo, você já sabe o que fazer.";
		app.ask(welcomePhrase);
	}

	

	welcomeP2(app){

		let givenName = '';
		if(app.isPermissionGranted()){
			console.log('--------------- Permission granted ---------------');
			givenName = app.getUserName().givenName;
			this.saveName(app.getUser().userId,givenName);
		}
		let welcomePhrase = "Seja bem vindo, " + givenName;
		app.tell(welcomePhrase);
	}

	saveName(userId, givenName){

		console.log('Saving name...');

		firebase.initializeApp(config);

		firebase.auth().signInWithEmailAndPassword('bruno.mourao.araujo@gmail.com','teste123').catch(function(error) {
			// Handle Errors here.
			var errorCode = error.code;
			var errorMessage = error.message;

			console.log('##### Error authenticating:' + errorCode + ' - ' + errorMessage);
		});

		firebase.database().ref('users/' + userId).set({
			name: givenName
			});

	}

	getGivenName(userId){

		console.log('---- getGivenName ----');

		firebase.initializeApp(config);

		firebase.auth().signInWithEmailAndPassword('bruno.mourao.araujo@gmail.com','teste123').catch(function(error) {
			// Handle Errors here.
			var errorCode = error.code;
			var errorMessage = error.message;

			console.log('##### Error authenticating:' + errorCode + ' - ' + errorMessage);
		});

		console.log('-------- Firebase inicializado');

		// Get a reference to the database service
		database = firebase.database();

		console.log('userId:' + userId);

		database.ref('/users/' + userId).once('value').then(function(snapshot){
			userName = (snapshot.val() && snapshot.val().name);
			console.log('Dentro da função, name=' + userName);
		});

		console.log('---- Fora da função, name=' + userName);

		// var options = {
		//   host: 'https://testprofiling-20d85.firebaseio.com/',
		//   path: '/users/' + userId,
		//   method: 'GET'
		// };
		// const req = http.request(options, function(res){
		// 	console.log('STATUS:' + res.statusCode);
		// 	res.setEncoding('utf8');
		// 	res.on('data', function(chunk){
		// 		console.log('Body:' + chunk);
		// 		if(req.data){
		// 			if (req.data.name) {
		// 	 			welcomePhrase = "Bem vindo de volta $1!".replace("$1",req.data.name);
		// 	 		}
		// 	 		else{
		// 	 			this.requestPermission(app);
		// 	 		}
		// 	 		app.ask(welcomePhrase);
		// 		}
		// 		app.tell('Fail');
		// 	});
		// });
	}
}

module.exports = TestProfiling;