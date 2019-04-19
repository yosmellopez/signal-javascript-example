'use strict';

const ls = window.libsignal;
const store = new window.SignalProtocolStore();

const KeyHelper = ls.KeyHelper;
const numberOfPreKeys = 2;
const serverBaseUrl = window.location.href;

let idKeyPair = {};
let registrationId;
let deviceId;
let preKeyObjects = [];
let preKeyObjectsToSend = [];
let signedPreKeyObject = {};

let myIdentifiers = {};
let myContacts = {};

// List element to display saved contacts
let listHTMLOfMyContacts, initErrorElement, initSuccessElement, sendErrorElement, sendSuccessElement, 
    requestKeysErrorElement, requestKeysSuccessElement, processKeysErrorElement, processKeysSuccessElement,
    messagingErrorElement, messagingSuccessElement;

document.addEventListener('DOMContentLoaded', e => {
    // Initializing HTML element variables
    listHTMLOfMyContacts = document.querySelector('#list-of-contacts');
    initErrorElement = document.querySelector('#error-init-container');
    initSuccessElement = document.querySelector('#success-init-container');
    sendErrorElement = document.querySelector('#error-send-container');
    sendSuccessElement = document.querySelector('#success-send-container');
    requestKeysErrorElement = document.querySelector('#error-request-keys-form');
    requestKeysSuccessElement = document.querySelector('#success-request-keys-form');
    processKeysErrorElement = document.querySelector('#error-process-keys-form');
    processKeysSuccessElement = document.querySelector('#success-process-keys-form');
    messagingErrorElement = document.querySelector('#error-messaging-form');
    messagingSuccessElement = document.querySelector('#success-messaging-form');

    document.querySelector('#init-my-identity').addEventListener('click', e => {
        let myDeviceId = parseInt(document.querySelector('#init-device-id').value);
        if(isNaN(myDeviceId)) {
            console.log('Por favor introduzca un ID de dispositivo numerico.');
            initErrorElement.innerHTML = 'Por favor introduzca un ID de dispositivo numerico.';
        } else {
            initErrorElement.innerHTML = '';
            deviceId = myDeviceId;
            generateResgistrationId(myDeviceId);
        }
    });
});

function generateResgistrationId(myDeviceId) {
    registrationId = KeyHelper.generateRegistrationId();
    myIdentifiers['registrationId'] = registrationId;
    myIdentifiers['deviceId'] = myDeviceId;
    store.put('registrationId', registrationId);
    document.querySelector('#init-registration-id').value = registrationId;
    waitForMessageSend();
    waitForMessageReceive();
    generateIdKey();
}

function generateIdKey() {
    KeyHelper.generateIdentityKeyPair().then(identityKeyPair => {
        idKeyPair = identityKeyPair;
        store.put('identityKey', idKeyPair);
        generatePreKeys()
    });
}

// Generate multiple PreKeys (as per documentation)
function generatePreKeys() {    
    let listOfPreKeysPromise = [];
    for(let i = 0; i < numberOfPreKeys; i++){
        listOfPreKeysPromise.push(KeyHelper.generatePreKey(registrationId + i + 1));
    }
    Promise.all(listOfPreKeysPromise).then(preKeys => {
        preKeys.forEach(preKey => {
            let preKeyObject = {
                keyId: preKey.keyId,
                keyPair: preKey.keyPair
            };
            preKeyObjects.push(preKeyObject);
            store.storePreKey(preKeyObject.keyId, preKeyObject.keyPair);
            let preKeyObjectToSend = {
                id: preKeyObject.keyId,
                key: window.arrBuffToBase64(preKeyObject.keyPair.pubKey)
            };
            preKeyObjectsToSend.push(preKeyObjectToSend); 
        });
        generateSignedPreKey();
    });
}

function generateSignedPreKey() {
    KeyHelper.generateSignedPreKey(idKeyPair, registrationId - 1).then(signedPreKey => {
        signedPreKeyObject = {
            keyId: signedPreKey.keyId,
            keyPair: signedPreKey.keyPair,
            signature: signedPreKey.signature
        }
        store.storeSignedPreKey(signedPreKey.keyId, signedPreKeyObject.keyPair);
        registerWithServer()
    });
}

function registerWithServer() {
    initSuccessElement.innerHTML = 'Inicialización Completa. Envíe los paquetes al servidor.'
    document.querySelector('#registration-id').value = registrationId;
    document.querySelector('#identity-key').value = window.arrBuffToBase64(idKeyPair.pubKey);
    document.querySelector('#signed-prekey-id').value = signedPreKeyObject.keyId;
    document.querySelector('#signed-prekey-key').value = window.arrBuffToBase64(signedPreKeyObject.keyPair.pubKey);
    document.querySelector('#signed-prekey-signature').value = window.arrBuffToBase64(signedPreKeyObject.signature);
    document.querySelector('#prekey-id').value = preKeyObjects[0].keyId;
    document.querySelector('#prekey-key').value = window.arrBuffToBase64(preKeyObjects[0].keyPair.pubKey);
    
    document.querySelector('#send-keys').addEventListener('click', e => {
        sendKeysToServer(); // Send inital key packet
        waitForKeys(); // Enable manually adding recipient's details to create a session
        waitForRequestKeys(); // Enable retrieve key functionality from server
    });
}

function sendKeysToServer() {
    let url = serverBaseUrl + 'send';
    let requestObject = {
        type: 'init',
        deviceId: deviceId,
        registrationId: registrationId,
        identityKey: window.arrBuffToBase64(idKeyPair.pubKey),
        signedPreKey: {
            id: signedPreKeyObject.keyId,
            key: window.arrBuffToBase64(signedPreKeyObject.keyPair.pubKey),
            signature: window.arrBuffToBase64(signedPreKeyObject.signature)
        },
        preKeys: preKeyObjectsToSend
    }

    window.sendRequest(url, requestObject).then(res => {
        if(res.err) {
            sendSuccessElement.innerHTML = '';
            sendErrorElement.innerHTML = (typeof res.err === 'string') ? res.err : res.err.toString();
        } else {
            sendErrorElement.innerHTML = '';
            sendSuccessElement.innerHTML = 'Paquete inicial entregado exitosamente.';
        }
    });
}

function waitForRequestKeys() {
    document.querySelector('#request-keys').addEventListener('click', event => {
        let requestObject = {
            registrationId: parseInt(document.querySelector('#request-keys-registration-id').value),
            deviceId: parseInt(document.querySelector('#request-keys-device-id').value)
        };
        let url = serverBaseUrl + 'get';
        window.sendRequest(url, requestObject).then(obj => {
            processReceivedKeys(obj);
        })
    });
}

function processReceivedKeys(resJson) {
    if(resJson.err) {
        requestKeysSuccessElement.innerHTML = '';
        requestKeysErrorElement.innerHTML = (typeof resJson.err === 'string') ? resJson.err : resJson.err.toString();
    } else {
        document.querySelector('#receive-registration-id').value = resJson.registrationId;
        document.querySelector('#receive-device-id').value = resJson.deviceId;
        document.querySelector('#receive-identity-key').value = resJson.identityKey;
        document.querySelector('#receive-signed-prekey-id').value = resJson.signedPreKey.id;
        document.querySelector('#receive-signed-prekey-key').value = resJson.signedPreKey.key;
        document.querySelector('#receive-signed-prekey-signature').value = resJson.signedPreKey.signature;
        document.querySelector('#receive-prekey-id').value = resJson.preKey.id;
        document.querySelector('#receive-prekey-key').value = resJson.preKey.key;

        requestKeysErrorElement.innerHTML = '';
        requestKeysSuccessElement.innerHTML = 'Claves para ' + resJson.registrationId + resJson.deviceId + ' adquiridas satisfactoriamente.'
    }
}

function waitForKeys() {
    document.querySelector('#parse-keys').addEventListener('click', event => {
        let processPreKeyObject = {
            registrationId: parseInt(document.querySelector('#receive-registration-id').value),
            identityKey: window.base64ToArrBuff(document.querySelector('#receive-identity-key').value),
            signedPreKey: {
                keyId: parseInt(document.querySelector('#receive-signed-prekey-id').value),
                publicKey: window.base64ToArrBuff(document.querySelector('#receive-signed-prekey-key').value),
                signature: window.base64ToArrBuff(document.querySelector('#receive-signed-prekey-signature').value)
            },
            preKey: {
                keyId: parseInt(document.querySelector('#receive-prekey-id').value),
                publicKey: window.base64ToArrBuff(document.querySelector('#receive-prekey-key').value)
            }
        };
        let incomingDeviceIdStr = document.querySelector('#receive-device-id').value;
        setupSession(processPreKeyObject, incomingDeviceIdStr);
    })
}

function setupSession(processPreKeyObject, incomingDeviceIdStr) {
    let recipientAddress = new ls.SignalProtocolAddress(processPreKeyObject.registrationId, incomingDeviceIdStr);
    let sessionBuilder = new ls.SessionBuilder(store, recipientAddress);
    sessionBuilder.processPreKey(processPreKeyObject)
        .then(resp => {
            console.log('Exito! Session Establecida!');
            // Store incoming key packet to known contacts
            myContacts[processPreKeyObject.registrationId + incomingDeviceIdStr] = {
                deviceId: parseInt(incomingDeviceIdStr),
                preKeyObject: processPreKeyObject
            };

            saveContact(processPreKeyObject.registrationId, incomingDeviceIdStr);

            processKeysErrorElement.innerHTML = '';
            processKeysSuccessElement.innerHTML = 'Contacto añadido exitosamente.'

        }).catch(err => {
            console.log('Fallido!');
            processKeysErrorElement.innerHTML = (typeof err === 'string') ? err : err.toString();
        });
}

function waitForMessageSend() {
    document.querySelector('#send-message').addEventListener('click', event => {
        let rawMessageStr = document.querySelector('#send-plaintext').value;
        let message = new TextEncoder("utf-8").encode(rawMessageStr);
        let messageTo = myContacts[parseInt(document.querySelector('#message-to-field').value)];
        if(message && messageTo) {
            sendMessageToServer(message, messageTo)
        } else {
          console.log('Mensaje Inválido');
          messagingSuccessElement.innerHTML = '';
          messagingErrorElement.innerHTML = 'Mensaje Inválido';
        }
    });
}

function sendMessageToServer(message, messageToObject) {
    let url = serverBaseUrl + 'send/message';

    let requestObject = {
        messageTo: {
            registrationId: messageToObject.preKeyObject.registrationId,
            deviceId: messageToObject.deviceId
        },
        messageFrom: {
            registrationId: myIdentifiers.registrationId,
            deviceId: myIdentifiers.deviceId
        },
        ciphertextMessage: 'Texto Cifrado Inválido',
    };

    let signalMessageToAddress = new ls.SignalProtocolAddress(requestObject.messageTo.registrationId, 
        requestObject.messageTo.deviceId);
    let sessionCipher = new ls.SessionCipher(store, signalMessageToAddress);

    sessionCipher.encrypt(message).then(ciphertext => {
        requestObject.ciphertextMessage = ciphertext;
        window.sendRequest(url, requestObject).then(res => {
            if(res.err) {
                console.log(res.err);
                messagingSuccessElement.innerHTML = '';
                messagingErrorElement.innerHTML = (typeof res.err === 'string') ? res.err : res.err.toString();    
            } else {
                console.log('Mensaje enviado satisfactoriamente al servidor');
                messagingErrorElement.innerHTML = '';
                messagingSuccessElement.innerHTML = 'Mensaje enviado satisfactoriamente al servidor.';
            }
        });
    }).catch(err => {
        messagingSuccessElement.innerHTML = '';
        messagingErrorElement.innerHTML = (typeof err === 'string') ? err : err.toString();
    });
}

function waitForMessageReceive() {
    document.querySelector('#receive-message').addEventListener('click', event => {
        let messageFrom = myContacts[document.querySelector('#message-from-field').value];

        if(messageFrom) {
            getMessagesFromServer(messageFrom);
        } else {
            getMessagesFromServer();
        }
    });
}

function getMessagesFromServer(messageFrom) {
    let url = serverBaseUrl + 'get/message';
    let messageFromUniqueId;

    if(messageFrom) {
        messageFromUniqueId = messageFrom.preKeyObject.registrationId.toString() + messageFrom.deviceId.toString(); 
    } else {
        messageFromUniqueId = document.querySelector('#message-from-field').value;
    }

    let requestObject = {
        messageTo: myIdentifiers,
        messageFromUniqueId: messageFromUniqueId
    };

    window.sendRequest(url, requestObject).then(res => {
        if(res.err) {
            console.log(res.err);
            messagingSuccessElement.innerHTML = '';
            messagingErrorElement.innerHTML = (typeof res.err === 'string') ? res.err : res.err.toString();
        } else {
            processIncomingMessage(res);
        }
    })
}

function processIncomingMessage(incomingMessageObj) {
    console.log(incomingMessageObj);
    let signalMessageFromAddress = new ls.SignalProtocolAddress(incomingMessageObj.messageFrom.registrationId, 
        incomingMessageObj.messageFrom.deviceId);
    let sessionCipher = new ls.SessionCipher(store, signalMessageFromAddress); 
    sessionCipher.decryptPreKeyWhisperMessage(incomingMessageObj.ciphertextMessage.body, 'binary').then(plaintext => {
        let decryptedMessage = window.util.toString(plaintext);
        console.log(decryptedMessage);
        document.querySelector('#receive-plaintext').value = decryptedMessage;

        saveContact(incomingMessageObj.messageFrom.registrationId.toString(), incomingMessageObj.messageFrom.deviceId.toString());

        messagingErrorElement.innerHTML = '';
        messagingSuccessElement.innerHTML = 'Mensaje desencriptado satisfactoriamente.';
    }).catch(err => {
        messagingSuccessElement.innerHTML = '';
        messagingErrorElement.innerHTML = (typeof err === 'string') ? err : err.toString();
    });
}

function saveContact(contactRegId, contactDevId) {
    let newContactItem = document.createElement('li');
    let listInnerString = 'ID de Dispositivo: ' + contactRegId + contactDevId + ' ID de Registro: ' + contactRegId
        + ' ID de Dispositivo: ' + contactDevId;

    newContactItem.appendChild(document.createTextNode(listInnerString));
    listHTMLOfMyContacts.appendChild(newContactItem);
}
