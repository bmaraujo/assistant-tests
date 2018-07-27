'use strict';

const functions = require('firebase-functions');
const firebase = require('firebase');
const fetch = require("node-fetch");
const fs = require('fs');
const {
  dialogflow,
  BasicCard,
  Button,
  RegisterUpdate,
  Suggestions,
  MediaObject,
  Image,
  LinkOutSuggestion,
  UpdatePermission,
  TransactionRequirements,
  DeliveryAddress,TransactionDecision, List,OrderUpdate,Permission
} = require('actions-on-google');
const app = dialogflow({debug: true});
const dialogsPtBR = JSON.parse(fs.readFileSync('./dialogs-ptbr.json', 'utf8'));
const dialogsEnUS = JSON.parse(fs.readFileSync('./dialogs-enus.json', 'utf8'));

const LOC_PTBR = "pt-BR";

const PUSH_NOTIFICATION_ASKED = 'push_notification_asked';

const CATEGORY = 'category';

let UNIQUE_ORDER_ID = 0;

const GENERIC_EXTENSION_TYPE =
  'type.googleapis.com/google.actions.v2.orders.GenericExtension';

const config = {
	apiKey: "",
	authDomain: "testprofiling-20d85.firebaseapp.com",
	databaseURL: "https://testprofiling-20d85.firebaseio.com",
	storageBucket: "testprofiling-20d85.appspot.com"
};

const CONTEXTS = {
	PUSH_NOTIFICATIONS : "PUSH_NOTIFICATIONS",
	PROCURAR_BAR_COPA : "PROCURAR_BAR_COPA"	
}

firebase.initializeApp(config);

let users;
let estabelecimentos;

let wait = true;

// firebase.database().ref('/users').once('value').then(function(snapshot) {
// 	console.log('getting users');
// 	console.log('snap= ' + JSON.stringify(snapshot.val()));
// 	users = snapshot.val();
// 	console.log(users);
// });

// firebase.database().ref('/establishment').once('value').then(function(snapshot) {
// 	console.log('getting estabelecimentos');
// 	estabelecimentos = snapshot.val();
// 	console.log(`Qtd: ${estabelecimentos.length}`);
// });

firebase.database().ref('/').once('value').then(function(snapshot) {
	console.log('getting everything');
	users = snapshot.val().users;
	estabelecimentos = snapshot.val().establishment;
	console.log(`Estabelecimentos: ${JSON.stringify(estabelecimentos)}`);
	
});

function readUserName(userId){
	console.log("readUserName - " + userId);
	console.log("->" + users[userId].name);
	return users[userId].name;
}


function getUserName(userId){   
	return new Promise(function (resolve, reject) {     
		firebase.database().ref('/users/' + userId).once('value').then(function(snapshot) {       
			resolve((snapshot.val() && snapshot.val().name) || 'Anonymous');     }).catch(reject);   }); }


function getLocalizedPhrase(key,locale){

	if(locale === LOC_PTBR){
		return dialogsPtBR[key];
	}
	else{
		return dialogsEnUS[key];
	}
}


function getUserCart(conv){
	if(!conv.user.storage.cart){
		console.log('no cart, creating a new one');
		let cart = {
			merchant : {
				id:'bma_test1',
				name: 'BMA Store'
			},
			lineItems: [],
			notes: 'FPS Games',
			otherItems:[]
		};
		conv.user.storage.cart = cart;	
	}
	console.log(`Cart: ${JSON.stringify(conv.user.storage.cart)}`)
	return conv.user.storage.cart;
}

function updateSubtotal(cart){

	let subtotal=0;
	let taxes=0;
	let taxRate = 0.07;// 7%

	for(let i=0; i< cart.lineItems.length;i++){
		let item = cart.lineItems[i];
		subtotal += (Number(item.price.amount.units) + Number(item.price.amount.nanos)/Math.pow(10,9));

	}

	taxes = subtotal * taxRate;

	let subTotalUnits = Math.trunc(subtotal);
	let subTotalNanos = (Math.trunc((subtotal*100 - subTotalUnits*100) * Math.pow(10,9)) + '').substring(0,9);

	let taxesUnits = Math.trunc(taxes);
	let taxesNanos = (Math.trunc((taxes*100 - taxesUnits*100) * Math.pow(10,9)) + '').substring(0,9);

	cart.otherItems = [{
          name: 'Subtotal',
          id: 'subtotal',
          price: {
            amount: {
              currencyCode: 'USD',
              nanos: subTotalNanos,
              units: subTotalUnits,
            },
            type: 'ESTIMATE',
          },
          type: 'SUBTOTAL',
        },
        {
          name: 'Tax',
          id: 'tax',
          price: {
            amount: {
              currencyCode: 'USD',
              nanos: taxesNanos,
              units: taxesUnits,
            },
            type: 'ESTIMATE',
          },
          type: 'TAX',
        },
      ];
}

function addItemToCart(conv, item){
	let cart = getUserCart(conv);

	let lineItem = {
		name: item.title,
		id: item.id,
		price: {
			amount: {
				currencyCode: 'USD',
				nanos: ((parseInt(item.price.split('.')[1]) * Math.pow(10,9)) + '').substring(0,9),
				units: item.price.split('.')[0]
			},
			type: 'ACTUAL'
		},
		quantity:1,
		subLines: [
          {
            note: item.description,
          },
        ],
		type: 'REGULAR'
	}

	cart.lineItems.push(lineItem);

	updateSubtotal(cart);

	conv.user.storage.cart = cart;
}

function getNewOrderId(){
	let _data = new Date();
	return 'O' + (_data.getMonth()+1) + _data.getDate() +  _data.getHours() + _data.getMinutes();
}


function getRandomEntry(arr){
		return arr[Math.floor(Math.random() * arr.length)];
	}

// firebase.initializeApp(config);

// firebase.auth().signInWithEmailAndPassword('teste@email.com','123456').catch(function(error) {
// 	// Handle Errors here.
// 	var errorCode = error.code;
// 	var errorMessage = error.message;

// 	console.log('##### Error authenticating:' + errorCode + ' - ' + errorMessage);
// });
// const users = firebase.database().ref('/users').once('value').then(function(snapshot) {
//   resolve((snapshot.val() && snapshot.val()) || 'Anonymous');
// });

app.intent('Default Welcome Intent', (conv) => {
	console.log(`locale? ${conv.user.locale}`);
	conv.ask(getLocalizedPhrase('WELCOME',conv.user.locale));
	conv.ask(new Suggestions(['Me dê uma dica','Testar base de dados','Toca uma música']));
});

app.intent('setup_push', (conv) => {
	conv.contexts.set(CONTEXTS.PUSH_NOTIFICATIONS,5);
  conv.ask(new UpdatePermission({intent: 'ultima dica'}));
});

app.intent('falar_dica', (conv, {category}) => {
	conv.ask(`Ok, ${category}. Nunca pingue limão no seu olho.`);
	if (!conv.user.storage[PUSH_NOTIFICATION_ASKED]) {
        conv.ask(new Suggestions('Me alerte de novas dicas'));
        conv.user.storage[PUSH_NOTIFICATION_ASKED] = true;
      }
});

app.intent('ultimas_dicas', (conv) => {
	conv.ask('Em terra de cego, quem tem olho é caolho.');
	if (!conv.user.storage[PUSH_NOTIFICATION_ASKED]) {
        conv.ask(new Suggestions('Me alerte de novas dicas'));
        conv.user.storage[PUSH_NOTIFICATION_ASKED] = true;
      }
});

app.intent('permission_handler', (conv, params, confirmationGranted) => {

	console.log(`user: ${JSON.stringify(conv.user)}`);

	console.log(`contexts: ${JSON.stringify(conv.contexts)}`);

	if (confirmationGranted) {



		// if(containsContext(conv.contexts.input,CONTEXTS.PROCURAR_BAR_COPA)){
		return handleProcurarBarPerto(conv);
		// }
		// else{
		// 	const userID = conv.user.id;

		// 	conv.close(`Ok, vou começar a lhe mandar alertas.`);
		// }

		

	} else {
		conv.close(`Ok, não irei enviar alertas.`);
	}
});


function containsContext(array, context){
	console.log(`Procurar contexto: ${context}`);
	for(let i = 0; i< array.length; i++){
		console.log(`${array[i].toLowerCase()}=${context.toLowerCase()}?`);
		if(array[i].toLowerCase().indexOf(context.toLowerCase()) > 0){
			console.log(`contexto encontrado`);
			return true;
		}
	}
	console.log(`contexto não encontrado`);
	return false;
}

app.intent('testa_baseDados', (conv) => {

	console.log('Dentro da intent testa_baseDados');

    

	const resposta = readUserName(conv.user.id);

	console.log('depois da funcao o nome é '+ resposta);

	conv.ask('O nome é ' + resposta);

});

app.intent('testMedia', (conv) => {
	console.log(`Has MEDIA_RESPONSE_AUDIO?: ${conv.surface.capabilities.has('actions.capability.MEDIA_RESPONSE_AUDIO')}`);
	if (!conv.surface.capabilities.has('actions.capability.MEDIA_RESPONSE_AUDIO')) {
	  conv.ask('Me desculpe, mas seu dispositivo não suporta playback de áudio');
	  return;
	}
	conv.ask('Abraço');
	conv.close(new MediaObject({
	  name: 'Demilitarized Zone',
	  url: 'https://firebasestorage.googleapis.com/v0/b/testprofiling-20d85.appspot.com/o/Demilitarized_Zone.mp3?alt=media&token=cb782584-e67e-47e7-b35f-70ff516d93a8',
	  description: 'Free music from Creators Studio',
	  icon: new Image({
	    url: 'https://lh3.googleusercontent.com/-JqZsH6CGW8M/U1PJtQUS1iI/AAAAAAAAAsw/BO-VwoSbPvU/IMG_8209.JPG?imgmax=912',
	    alt: 'The Korean Demilitarized Zone monument',
	  }),
	}));
});


app.intent('testLimitSSML', (conv) =>{
	conv.ask('<speak><audio src="https://testprofiling-20d85.firebaseapp.com/Sunny_Looks_Good_on_You.mp3">Não deu para tocar</audio></speak>');
});

// app.intent('transaction_start_custom', (conv) => {
// 	conv.ask(new DeliveryAddress({
// 	  addressOptions: {
// 	    reason: getLocalizedPhrase('START_TRANSACTION', conv.user.locale),
// 	  },
// 	}));
// });

// const PRODUCTS_KEYS = {
//   [SELECTION_PUGB]: 'PUGB', //https://steamcdn-a.akamaihd.net/steam/apps/578080/header.jpg?t=1525138879 - 55,99
//   [SELECTION_ARMA3]: 'ARMA3', // https://steamcdn-a.akamaihd.net/steam/apps/107410/header.jpg?t=1524502112 - 89,99
//   [SELECTION_SQUAD]: 'SQUAD', //https://steamcdn-a.akamaihd.net/steam/apps/393380/header.jpg?t=1527101610 - 72,99
//   [SELECTION_INSURGENCY] : 'INSURGENCY' // https://steamcdn-a.akamaihd.net/steam/apps/222880/header.jpg?t=1514661178 - 19,99
// };

const PRODUCTS = {
	'PUGB' : {
		synonyms: ['Player Unknown','Battlegrounds'],
		title: 'Player Unknown Battlegrounds',
		description: 'The acclaimed battle royale game. $55.99',
		id: 'pugb1',
		price: '55.99',
		image: new Image({
			url: 'https://steamcdn-a.akamaihd.net/steam/apps/578080/header.jpg?t=1525138879',
			alt: 'PUGB'
		}),
	},
	'ARMA3': {
		synonyms: ['Arma','Arma 3', 'Arma III'],
		title: 'Arma III',
		description: 'Experience true combat gameplay in a massive military sandbox. $89.99',
		id: 'arma3',
		price: '89.99',
		image: new Image({
			url: 'https://steamcdn-a.akamaihd.net/steam/apps/107410/header.jpg?t=1524502112',
			alt: 'ARMA'
		}),
	},
	'SQUAD': {
		synonyms: ['Squad'],
		title: 'Squad',
		description: 'Squad is a 50 vs 50 MP FPS. $72.00',
		id: 'squad3',
		price: '72.00',
		image: new Image({
			url: 'https://steamcdn-a.akamaihd.net/steam/apps/393380/header.jpg?t=1527101610',
			alt: 'Squad'
		}),
	},
	'INSURGENCY': {
		synonyms: ['Insurgency'],
		title: 'Insurgency',
		description: "Close Quarters MP. $19.00",
		id: 'insurgency4',
		price: '19.00',
		image: new Image({
			url: 'https://steamcdn-a.akamaihd.net/steam/apps/222880/header.jpg?t=1514661178',
			alt: 'Insurgency'
		}),
	},
}

app.intent('show_products',(conv) =>{
	console.log(JSON.stringify(PRODUCTS));
	conv.ask(getLocalizedPhrase('SHOW_PRODUCTS',conv.user.locale));
	conv.ask(new List({
		title: 'Products',
		items: PRODUCTS
	}));
});

app.intent('item_select_handler', (conv, params, option) => {
	console.log('intent de seleção');

	let response = 'You did not select any item';

	if (option) {
		addItemToCart(conv,PRODUCTS[option]);
		response = getLocalizedPhrase('ADD_ITEM_CART', conv.user.locale).replace('$1',PRODUCTS[option].title);
	}
	conv.ask(response);
});

app.intent('DELIVERY_ADDRESS_helper', (conv) => {

	const arg = conv.arguments.get('DELIVERY_ADDRESS_VALUE');

	if (arg.userDecision ==='ACCEPTED') {
		console.log('DELIVERY ADDRESS: ' + arg.location.postalAddress.addressLines[0]);
		conv.ask('Great, got your address! Now say "confirm transaction".');
		conv.ask(new List({
			title: 'Products',
			items: PRODUCTS
		}));
	} 
	else {
		conv.close('Transaction failed.');
	}
});

app.intent('transaction_check_nopayment', (conv) => {
  conv.ask(new TransactionRequirements());
});

app.intent('transaction_check_action', (conv) => {

	console.log(`transaction with action payment`);
  conv.ask(new TransactionRequirements({
    orderOptions: {
      requestDeliveryAddress: false,
    },
    paymentOptions: {
      actionProvidedOptions: {
        displayName: 'VISA-1234',
        paymentType: 'PAYMENT_CARD',
      },
    },
  }));
});

app.intent('transaction_check_google', (conv) => {
  conv.ask(new TransactionRequirements({
    orderOptions: {
      requestDeliveryAddress: false,
    },
    paymentOptions: {
      googleProvidedOptions: {
        prepaidCardDisallowed: false,
        supportedCardNetworks: ['VISA', 'AMEX'],
        // These will be provided by payment processor,
        // like Stripe, Braintree, or Vantiv.
        tokenizationParameters: {},
      },
    },
  }));
});

app.intent('transaction_check_complete', (conv) => {
  const arg = conv.arguments.get('TRANSACTION_REQUIREMENTS_CHECK_RESULT');
  if (arg && arg.resultType ==='OK') {
    // Normally take the user through cart building flow
    conv.ask(`Looks like you're good to go! ` +
      `Try saying "Get Delivery Address".`);
  } else {
    conv.close('Transaction failed.');
  }
});

app.intent('delivery_address', (conv) => {
  conv.ask(new DeliveryAddress({
    addressOptions: {
      reason: 'To know where to send the order',
    },
  }));
});

app.intent('delivery_address_complete', (conv) => {
  const arg = conv.arguments.get('DELIVERY_ADDRESS_VALUE');
  if (arg.userDecision ==='ACCEPTED') {
    console.log('DELIVERY ADDRESS: ' +
    arg.location.postalAddress.addressLines[0]);
    conv.data.deliveryAddress = arg.location;
    if(conv.user.storage.order){//order already created
    	conv.user.storage.order.extension = {
		      '@type': GENERIC_EXTENSION_TYPE,
		      'locations': [
		        {
		          type: 'DELIVERY',
		          location: {
		            postalAddress: arg.location.postalAddress,
		          },
		        },
		      ],
		    };

		console.log(`order a ser enviada: ${JSON.stringify(conv.user.storage.order)}`);

		conv.data.orderid = conv.user.storage.order.id;
    	conv.ask(new TransactionDecision({
			orderOptions: {
			  requestDeliveryAddress: true,
			},
			paymentOptions: {
			  actionProvidedOptions: {
			    paymentType: 'PAYMENT_CARD',
			    displayName: 'VISA-1234',
			  },
			},
			proposedOrder: conv.user.storage.order,
		}));
    }
    else{
    	conv.ask('Great, got your address! Now say "confirm transaction".');	
    }
    
  } else {
    conv.close('I failed to get your delivery address.');
  }
});

app.intent('transaction_decision_action', (conv) => {

	let userCart = conv.user.storage.cart;

	console.log(`cart: ${JSON.stringify(userCart)}`);

	//Adding Taxes to the total
	let total = (Number(userCart.otherItems[1].price.amount.units) + Number(userCart.otherItems[1].price.amount.nanos)/Math.pow(10,9));

	for(let i= 0; i<userCart.lineItems.length; i++){
		let item = userCart.lineItems[i];
		total+= (Number(item.price.amount.units) + Number(item.price.amount.nanos)/Math.pow(10,9));
	}

	let totalUnits = Math.trunc(total);
	let totalNanos = (Math.trunc((total*Math.pow(10,5) - totalUnits*Math.pow(10,5)) * Math.pow(10,9)) + '').substring(0,9);

	let order;
	if(!conv.user.storage.order){
		console.log(`building the order`);
		UNIQUE_ORDER_ID = getNewOrderId();
		console.log(`Orderid: ${UNIQUE_ORDER_ID}`);
		order = {
			id: UNIQUE_ORDER_ID,
			cart: userCart,
			otherItems: [],
			totalPrice: {
			  amount: {
			    currencyCode: 'USD',
			    nanos: totalNanos,
			    units: totalUnits,
			  },
			  type: 'ESTIMATE',
			},
		};		
	}
	else{
		console.log(`using stored order`);
		order = conv.user.storage.order;
		order.cart = userCart;
		order.totalPrice =  {
			  amount: {
			    currencyCode: 'USD',
			    nanos: totalNanos,
			    units: totalUnits,
			  },
			  type: 'ESTIMATE',
			};
	}


	console.log(`Order: ${JSON.stringify(order)}`);

	conv.user.storage.order = order;

	if(order.extension){//delivery address already on the order
		console.log(`Delivery address already on the order`);
		conv.data.orderid = order.id;
		conv.ask(new TransactionDecision({
			orderOptions: {
			  requestDeliveryAddress: true,
			},
			paymentOptions: {
			  actionProvidedOptions: {
			    paymentType: 'PAYMENT_CARD',
			    displayName: 'VISA-1234',
			  },
			},
			proposedOrder: order,
		}));
	}

	else{
		console.log(`no delivery address on the order`);
		if(conv.data.deliveryAddress) {
			console.log(`Delivery address on conversation`);
		    order.extension = {
		      '@type': GENERIC_EXTENSION_TYPE,
		      'locations': [
		        {
		          type: 'DELIVERY',
		          location: {
		            postalAddress: conv.data.deliveryAddress.postalAddress,
		          },
		        },
		      ],
		    };
		    conv.data.orderid = order.id;
		    conv.ask(new TransactionDecision({
				orderOptions: {
				  requestDeliveryAddress: true,
				},
				paymentOptions: {
				  actionProvidedOptions: {
				    paymentType: 'PAYMENT_CARD',
				    displayName: 'VISA-1234',
				  },
				},
				proposedOrder: order,
			}));
	  	}
	  	else{
	  		console.log(`aks for delivery order`);
	  		conv.ask(new DeliveryAddress({
		    	addressOptions: {
		      	reason: getLocalizedPhrase('DELIVERY_ADDRESS_JUSTI', conv.user.locale),
		   	 },
		  	}));
	  	}
	}

	console.log(`Wait, what?`);

  // To test payment w/ sample,
  // uncheck the 'Testing in Sandbox Mode' box in the
  // Actions console simulator
 

  /*
    // If using Google provided payment instrument instead
    conv.ask(new TransactionDecision({
    orderOptions: {
      requestDeliveryAddress: false,
    },
    paymentOptions: {
      googleProvidedOptions: {
        prepaidCardDisallowed: false,
        supportedCardNetworks: ['VISA', 'AMEX'],
        // These will be provided by payment processor,
        // like Stripe, Braintree, or Vantiv.
        tokenizationParameters: {},
      },
    },
    proposedOrder: order,
  }));
  */
});

app.intent('transaction_decision_complete', (conv) => {
  console.log('Transaction decision complete');
  const arg = conv.arguments.get('TRANSACTION_DECISION_VALUE');
  if (arg && arg.userDecision ==='ORDER_ACCEPTED') {
    const finalOrderId = arg.order.finalOrder.id;

    // Confirm order and make any charges in order processing backend
    // If using Google provided payment instrument:
    // const paymentDisplayName = arg.order.paymentInfo.displayName;
    conv.ask(new OrderUpdate({
      actionOrderId: finalOrderId,
      orderState: {
        label: 'Order created',
        state: 'CREATED',
      },
      lineItemUpdates: {},
      updateTime: new Date().toISOString(),
      receipt: {
        confirmedActionOrderId: conv.data.orderid,
      },
      // Replace the URL with your own customer service page
      orderManagementActions: [
        {
          button: {
            openUrlAction: {
              url: 'http://example.com/customer-service',
            },
            title: 'Customer Service',
          },
          type: 'CUSTOMER_SERVICE',
        },
      ],
      userNotification: {
        text: 'Notification text.',
        title: 'Notification Title',
      },
    }));
    //save the last user order
    conv.user.storage.lastOrderid = conv.data.orderid;

    conv.user.storage.cart = undefined;
    conv.user.storage.order = undefined;

    conv.ask(getLocalizedPhrase('TRANSACTION_COMPLETE', conv.user.locale));

  } else if (arg && arg.userDecision === 'DELIVERY_ADDRESS_UPDATED') {
    conv.ask(new DeliveryAddress({
      addressOptions: {
        reason: 'To know where to send the order',
      },
    }));
  } else {
    conv.close('Transaction failed.');
  }
});


app.intent('order_test', (conv) =>{
	const order = {
	  id: UNIQUE_ORDER_ID,
	  cart: {
	    merchant: {
	      id: 'book_store_1',
	      name: 'Book Store',
	    },
	    lineItems: [
	      {
	        name: 'My Memoirs',
	        id: 'memoirs_1',
	        price: {
	          amount: {
	            currencyCode: 'USD',
	            nanos: 990000000,
	            units: 3,
	          },
	          type: 'ACTUAL',
	        },
	        quantity: 1,
	        subLines: [
	          {
	            note: 'Note from the author',
	          },
	        ],
	        type: 'REGULAR',
	      },
	      {
	        name: 'Memoirs of a person',
	        id: 'memoirs_2',
	        price: {
	          amount: {
	            currencyCode: 'USD',
	            nanos: 990000000,
	            units: 5,
	          },
	          type: 'ACTUAL',
	        },
	        quantity: 1,
	        subLines: [
	          {
	            note: 'Special introduction by author',
	          },
	        ],
	        type: 'REGULAR',
	      },
	      {
	        name: 'Their memoirs',
	        id: 'memoirs_3',
	        price: {
	          amount: {
	            currencyCode: 'USD',
	            nanos: 750000000,
	            units: 15,
	          },
	          type: 'ACTUAL',
	        },
	        quantity: 1,
	        subLines: [
	          {
	            lineItem: {
	              name: 'Special memoir epilogue',
	              id: 'memoirs_epilogue',
	              price: {
	                amount: {
	                  currencyCode: 'USD',
	                  nanos: 990000000,
	                  units: 3,
	                },
	                type: 'ACTUAL',
	              },
	              quantity: 1,
	              type: 'REGULAR',
	            },
	          },
	        ],
	        type: 'REGULAR',
	      },
	      {
	        name: 'Our memoirs',
	        id: 'memoirs_4',
	        price: {
	          amount: {
	            currencyCode: 'USD',
	            nanos: 490000000,
	            units: 6,
	          },
	          type: 'ACTUAL',
	        },
	        quantity: 1,
	        subLines: [
	          {
	            note: 'Special introduction by author',
	          },
	        ],
	        type: 'REGULAR',
	      },
	    ],
	    notes: 'The Memoir collection',
	    otherItems: [
	      {
	        name: 'Subtotal',
	        id: 'subtotal',
	        price: {
	          amount: {
	            currencyCode: 'USD',
	            nanos: 220000000,
	            units: 32,
	          },
	          type: 'ESTIMATE',
	        },
	        type: 'SUBTOTAL',
	      },
	      {
	        name: 'Tax',
	        id: 'tax',
	        price: {
	          amount: {
	            currencyCode: 'USD',
	            nanos: 780000000,
	            units: 2,
	          },
	          type: 'ESTIMATE',
	        },
	        type: 'TAX',
	      },
	    ],
	  },
	  otherItems: [],
	  totalPrice: {
	    amount: {
	      currencyCode: 'USD',
	      nanos: 0,
	      units: 35,
	    },
	    type: 'ESTIMATE',
	  },
	};

	conv.user.storage.order = order;
	conv.user.storage.cart = order.cart;
	console.log(`loading standard order: ${JSON.stringify(order)}`);
	conv.ask('Ok, standard order loaded.');
});

app.intent('order_reset', (conv) =>{
	conv.user.storage.order = undefined;
	conv.ask('Order cleared');
	conv.ask(new Suggestions('Show me the products'));
});

app.intent('cart_reset', (conv) =>{
	conv.user.storage.cart = undefined;
	conv.ask('Cart cleared');
	conv.ask(new Suggestions('Show me the products'));
});

app.intent('copa_estabelecimentos_perto', (conv) =>{

	console.log(`Pedindo permissao`);

	conv.contexts.set(CONTEXTS.PROCURAR_BAR_COPA,3);

	const options = {
	    context: 'Para isto eu tenho que saber onde você está. Então',
	    // Ask for more than one permission. User can authorize all or none.
	    permissions: ['DEVICE_PRECISE_LOCATION'],
	  };

	conv.ask(new Permission(options));

	
});

const  handleProcurarBarPerto = (conv) =>{
	console.log(`DEVICE: ${JSON.stringify(conv.device)}`);

	let lat1 = conv.device.location.coordinates.latitude;
	let lon1 = conv.device.location.coordinates.longitude;

	let geoURL = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat1},${lon1}&key=AIzaSyCrqcH0PeNMdfGD07yBsolGX677mgVL73Q`;
	console.log(geoURL);

	return fetch(geoURL)
	    .then(res => res.text())
	    .then(body => {
	    	console.log(`body:${body}`);
	    	let lugares = procurarBarPerto(JSON.parse(body),lat1,lon1);
	    	console.log(`lugares:${JSON.stringify(lugares)}`);
	    	let local = getRandomEntry(lugares);
	    	
	    	

	    	conv.ask(`Que tal assistir em ${local.name_best}? Fica em ${local.address_best.split('-')[0]}`);
	    	conv.ask(new LinkOutSuggestion({
	    		name: "Mapa",
	    		url: local.mapsUrl
	    	}));
	    	return;
	    	
	    });	
}

function procurarBarPerto(results,lat1,lon1) {

		let result = results.results[0];

		let i=0; 
		let stop = false;
		let city;
		while(i<result.address_components.length && !stop){
			let addr = result.address_components[i++];
			console.log(` ${new String(addr.types[0]).valueOf() } == ${new String('locality').valueOf()}? ${new String(addr.types[0]).valueOf() == new String('locality').valueOf()}`);
			if(new String(addr.types[0]).valueOf() == new String('locality').valueOf()){
				city = addr.short_name;
				stop = true;
			}
		}

		console.log(`Cidade: ${city}`);
		console.log(`Estabelecimentos: ${estabelecimentos[city]}`)

		let R = 6371e3; // diametro da terra em metros

		let locais = {
			'2km' : [],
			'4km' : [],
			'8km' : [],
			'16km': []
		};

		for(let i=0; i<estabelecimentos[city].length;i++){
			let local = estabelecimentos[city][i];

			console.log(`local: ${JSON.stringify(local)}`);

			let lat2 = convert(JSON.parse(local.point_proto).lat_e7);
			let lon2 = convert(JSON.parse(local.point_proto).lng_e7);

			local.mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + lat2 + ',' + lon2;

			console.log(local.mapsUrl);

			console.log(JSON.parse(local.point_proto));

			console.log(`lat2: ${lat2} - lon2:${lon2}`);

			var phi1 = lat1 * Math.PI / 180;
			var phi2 = lat2 * Math.PI / 180;

			console.log(`phi1: ${phi1} - phi2:${phi2}`);

			var deltaPhi = (lat2-lat1) * Math.PI / 180;

			console.log(`deltaPhi: ${deltaPhi}`);

			var deltaLambda = (lon2-lon1) * Math.PI / 180;

			console.log(`deltaLambda: ${deltaLambda}`);

			var a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
			        Math.cos(phi1) * Math.cos(phi2) *
			        Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);

			console.log(`a: ${a}`);

			var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

			console.log(`c: ${c}`);

			var d = R * c;

			console.log(`${local.name_best} -> ${d}`);

			if(d<=2000){
				locais['2km'].push(local);
			}
			else if(d<=4000){
				locais['4km'].push(local);
			}
			else if(d<=8000){
				locais['8km'].push(local);
			}
			else if(d<=16000){
				locais['16km'].push(local);
			}
		}

	  	let arr;

	  	if(locais['2km'].length > 0){
	  		arr = locais['2km'];
	  	}
	  	else if(locais['4km'].length > 0){
	  		arr = locais['4km'];
	  	}
		else if(locais['8km'].length > 0){
	  		arr = locais['8km'];
	  	}
		else if(locais['16km'].length > 0){
	  		arr = locais['16km'];	
	  	}
		
		return arr;

}

function convert(num){
	let resposta;
	console.log(`${num} > ${Math.pow(2,32)/2}? ${(num > Math.pow(2,32)/2)}`);
	if(num > (Math.pow(2,32)/2)){
		resposta = (num-Math.pow(2,32))/Math.pow(10,7);
	}
	else{
		 resposta = (num)/Math.pow(10,7);
	}	
	console.log(resposta);
	return resposta;
}

app.intent("linkMap", (conv ,{number,geoCity,streetAddress}) => {
	console.log('mapa');
	conv.ask("Vai la");
	conv.ask(new BasicCard({
		text: streetAddress + ',' + number + ' ' + geoCity,
		title: 'Mapa',
		buttons: new Button({
			title: 'Vai',
			url: `https://www.google.com/maps/search/${streetAddress},${number}+-+${geoCity}`
		})
	}));
});

// v

// async function getUserName(userId){
// 	console.log('UserId:' + userId);
// 	return await firebase.database().ref('/users/' + userId).once('value').then(function(snapshot) {
// 	  	var username = (snapshot.val() && snapshot.val().name) || 'Anonymous';
// 	  return username;
// 	});
// }

exports.TestProfiling = functions.https.onRequest(app);