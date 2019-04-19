'use strict';

const express = require('express');

const app = express();

app.use(express.json({strict: true}));

app.use(express.static(__dirname));
app.get('*', (req, res) => {
    res.sendfile(__dirname + '/index.html')
});

app.listen(3000, () => console.log('listening on 3000'));

app.post('/send', receiveKeys);
app.post('/get', sendKeys);
app.post('/send/message', storeIncomingMessage);
app.post('/get/message', forwardMessageToClient);

var storageMap = {};
var messageStorageMap = {};

function receiveKeys(req, res) {
    let reqObj = req.body;
    //console.log(req.body);
    let storageKey = reqObj.registrationId.toString() + reqObj.deviceId.toString();
    if (storageMap[storageKey]) {
        res.json({err: 'Ya existe este paquete inicial del usuario'});
    } else {
        storageMap[storageKey] = reqObj;
        res.json({msg: 'Paquete inicial guardado exitosamente.'});
    }
    console.log('\n');
    console.log('storageMap~~~~~~~');
    console.log(storageMap);
}

function sendKeys(req, res) {
    let reqObj = req.body;
    let storageKey = reqObj.registrationId.toString() + reqObj.deviceId.toString();
    let responseObject;
    if (storageMap[storageKey]) {
        if (storageMap[storageKey].preKeys.length !== 0) {
            responseObject = JSON.parse(JSON.stringify(storageMap[storageKey]));
            responseObject.preKey = responseObject.preKeys[responseObject.preKeys.length - 1];
            storageMap[storageKey].preKeys.pop();
        } else {
            responseObject = {err: 'Fuera de preKeys para este usuario.'}
        }
    } else {
        responseObject = {
            err: 'Las claves ' + storageKey + ' para el usuario no exiten'
        }
    }
    console.log(responseObject);
    res.json(responseObject);
}

function storeIncomingMessage(req, res) {
    let reqObj = req.body;
    let messageStorageKey = reqObj.messageTo.registrationId.toString() + reqObj.messageTo.deviceId.toString() + reqObj.messageFrom.registrationId.toString() + reqObj.messageFrom.deviceId.toString();
    if (messageStorageMap[messageStorageKey]) {
        res.json({err: 'Solo se puede enviar un mensaje'});
    } else {
        messageStorageMap[messageStorageKey] = reqObj;
        res.json({msg: 'Mensaje guardado exitosamente.'});
    }
    console.log('\n');
    console.log('~~~~~~~messageStorageMap~~~~~~~');
    console.log(messageStorageMap);
}

function forwardMessageToClient(req, res) {
    let reqObj = req.body;
    let messageStorageKey = reqObj.messageTo.registrationId.toString() + reqObj.messageTo.deviceId.toString() + reqObj.messageFromUniqueId;
    let responseObject;
    if (messageStorageMap[messageStorageKey]) {
        if (storageMap[reqObj.messageFromUniqueId]) {
            responseObject = messageStorageMap[messageStorageKey];
            responseObject.messageFrom = {
                registrationId: storageMap[reqObj.messageFromUniqueId].registrationId,
                deviceId: storageMap[reqObj.messageFromUniqueId].deviceId
            };
        } else {
            {
                err: 'El cliente: ' + reqObj.messageFromUniqueId + ' no está registrador en el servidor.'
            }
        }
    } else {
        responseObject = {err: 'El mensaje de : ' + reqObj.messageFromUniqueId + ' a: ' + reqObj.messageTo.registrationId.toString() + reqObj.messageTo.deviceId.toString() + ' no existe'};
    }
    res.json(responseObject);
}
