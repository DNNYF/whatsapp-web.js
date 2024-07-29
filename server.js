const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let isAuthenticated = false;
const contacts = new Set();

let client = createClient();

function createClient() {
     const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            // args: [ '--no-sandbox', '--disable-gpu', ],
            pipe: true
        },
        webVersionCache: { type: 'remote', remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html', }
    });

    client.on('qr', (qr) => {
        qrcode.toDataURL(qr, (err, url) => {
            if (err) {
                console.error('Failed to generate QR code', err);
            } else {
                io.emit('qr', url);
            }
        });
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        isAuthenticated = true;
        io.emit('ready');
    });

    client.on('authenticated', () => {
        console.log('Client is authenticated!');
    });

    client.on('auth_failure', msg => {
        console.error('AUTHENTICATION FAILURE', msg);
        isAuthenticated = false;
        restartClient();
    });

    client.on('disconnected', reason => {
        console.error('Client was logged out', reason);
        isAuthenticated = false;
        restartClient();
    });

    client.on('message', msg => {
        console.log('Message received:', msg.body);
        contacts.add(msg.from);
        io.emit('message', msg);
    });

    client.initialize();

    return client;
}

function restartClient() {
    console.log('Restarting client...');
    if (client) {
        client.destroy();
    }
    client = createClient();
}

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.emit('auth_status', isAuthenticated);

    socket.on('sendMessage', (number, message) => {
        if (isAuthenticated) {
            number = formatNumber(number);
            console.log(`Sending message to ${number}`);
            client.sendMessage(number, message).catch(err => {
                console.error('Error sending message:', err);
                restartClient();
            });
        }
    });

    socket.on('sendFile', (number, filePath) => {
        if (isAuthenticated) {
            number = formatNumber(number);
            console.log(`Sending file to ${number}`);
            const media = MessageMedia.fromFilePath(filePath);
            client.sendMessage(number, media).catch(err => {
                console.error('Error sending file:', err);
                restartClient();
            });
        }
    });
});

function formatNumber(number) {
    number = number.replace(/\D/g, ''); 
    if (number.startsWith('0')) {
        number = '62' + number.slice(1); 
    }
    if (!number.startsWith('62')) {
        number = '62' + number;
    }
    return number + '@c.us'; 
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000/');
});
