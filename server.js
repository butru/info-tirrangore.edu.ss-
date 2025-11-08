const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (in production, use a database)
let users = [];
let channels = [
    {
        id: 'general',
        name: 'General',
        description: 'General community discussions',
        type: 'general',
        members: []
    },
    {
        id: 'announcements',
        name: 'Announcements',
        description: 'Important community announcements',
        type: 'announcements',
        members: []
    },
    {
        id: 'events',
        name: 'Events',
        description: 'Community events and activities',
        type: 'events',
        members: []
    }
];
let messages = [];
let events = [];

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User joins the platform
    socket.on('user-join', (userData) => {
        const user = {
            id: socket.id,
            socketId: socket.id,
            name: userData.name,
            email: userData.email,
            role: userData.role || 'Member',
            isOnline: true,
            lastSeen: new Date().toISOString(),
            joinTime: new Date().toISOString()
        };

        // Remove if user already exists (reconnection)
        users = users.filter(u => u.id !== user.id);
        users.push(user);

        // Send current state to the new user
        socket.emit('initial-data', {
            users: users,
            channels: channels,
            messages: messages.filter(msg => 
                msg.timestamp > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
            ),
            events: events.filter(event => 
                new Date(event.date) > new Date() // Future events
            )
        });

        // Notify all users about new user
        socket.broadcast.emit('user-joined', user);
        io.emit('users-update', users);
        
        console.log(`User ${user.name} joined the platform`);
    });

    // User sends a message
    socket.on('send-message', (messageData) => {
        const message = {
            id: uuidv4(),
            userId: socket.id,
            user: users.find(u => u.id === socket.id),
            channelId: messageData.channelId,
            content: messageData.content,
            type: messageData.type || 'text',
            timestamp: new Date().toISOString()
        };

        messages.push(message);
        
        // Broadcast to all users in the channel
        io.emit('new-message', message);
        console.log(`New message in ${messageData.channelId}: ${messageData.content}`);
    });

    // User creates an event
    socket.on('create-event', (eventData) => {
        const event = {
            id: uuidv4(),
            title: eventData.title,
            description: eventData.description,
            date: eventData.date,
            location: eventData.location,
            organizer: socket.id,
            organizerName: users.find(u => u.id === socket.id)?.name || 'Unknown',
            attendees: [socket.id],
            createdAt: new Date().toISOString()
        };

        events.push(event);
        io.emit('new-event', event);
        console.log(`New event created: ${eventData.title}`);
    });

    // User joins an event
    socket.on('join-event', (eventId) => {
        const event = events.find(e => e.id === eventId);
        if (event && !event.attendees.includes(socket.id)) {
            event.attendees.push(socket.id);
            io.emit('event-updated', event);
            console.log(`User joined event: ${event.title}`);
        }
    });

    // User leaves an event
    socket.on('leave-event', (eventId) => {
        const event = events.find(e => e.id === eventId);
        if (event) {
            event.attendees = event.attendees.filter(id => id !== socket.id);
            io.emit('event-updated', event);
            console.log(`User left event: ${event.title}`);
        }
    });

    // User is typing
    socket.on('typing-start', (data) => {
        socket.broadcast.emit('user-typing', {
            userId: socket.id,
            userName: users.find(u => u.id === socket.id)?.name,
            channelId: data.channelId
        });
    });

    socket.on('typing-stop', (data) => {
        socket.broadcast.emit('user-stopped-typing', {
            userId: socket.id,
            channelId: data.channelId
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const user = users.find(u => u.id === socket.id);
        if (user) {
            user.isOnline = false;
            user.lastSeen = new Date().toISOString();
            
            io.emit('user-left', user);
            io.emit('users-update', users);
            
            console.log(`User ${user.name} disconnected`);
        }
    });

    // Handle reconnection
    socket.on('reconnect-user', (userData) => {
        const user = users.find(u => u.id === userData.id);
        if (user) {
            user.isOnline = true;
            user.socketId = socket.id;
            io.emit('users-update', users);
        }
    });
});

// REST API endpoints
app.get('/api/users', (req, res) => {
    res.json(users);
});

app.get('/api/channels', (req, res) => {
    res.json(channels);
});

app.get('/api/messages/:channelId', (req, res) => {
    const channelMessages = messages.filter(msg => 
        msg.channelId === req.params.channelId
    );
    res.json(channelMessages);
});

app.get('/api/events', (req, res) => {
    res.json(events);
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Community Comms Server running on port ${PORT}`);
    console.log(`📧 Access your app at: http://localhost:${PORT}`);
});