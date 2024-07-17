const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let isAuthenticated = false;
const contacts = new Set();

const client = new Client({
    authStrategy: new LocalAuth()
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
});

client.on('message', msg => {
    console.log('Message received:', msg.body);
    contacts.add(msg.from);
    io.emit('message', msg);
});

client.initialize();

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.emit('auth_status', isAuthenticated);

    socket.on('sendMessage', (number, message) => {
        if (isAuthenticated) {
            number = formatNumber(number);
            console.log(`Sending message to ${number}`);
            client.sendMessage(number, message).catch(err => console.error('Error sending message:', err));
        }
    });

    socket.on('sendFile', (number, filePath) => {
        if (isAuthenticated) {
            number = formatNumber(number);
            console.log(`Sending file to ${number}`);
            const media = MessageMedia.fromFilePath(filePath);
            client.sendMessage(number, media).catch(err => console.error('Error sending file:', err));
        }
    });
});

function formatNumber(number) {
    // Pastikan nomor telepon diformat ke bentuk internasional
    number = number.replace(/\D/g, ''); // Hapus semua karakter non-digit
    if (number.startsWith('0')) {
        number = '62' + number.slice(1); // Ganti '0' di depan dengan kode negara '62' untuk Indonesia
    }
    if (!number.startsWith('62')) {
        number = '62' + number; // Tambahkan '62' di depan jika belum ada
    }
    return number + '@c.us'; // Tambahkan domain yang diharapkan oleh WhatsApp
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
