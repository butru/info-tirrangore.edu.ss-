// Community Communication Platform - Main JavaScript

// Real-time Socket.io connection
class RealTimeComms {
    constructor() {
        this.socket = io();
        this.setupSocketEvents();
    }

    setupSocketEvents() {
        // Receive initial data when connecting
        this.socket.on('initial-data', (data) => {
            commsApp.users = data.users;
            commsApp.channels = data.channels;
            commsApp.messages = data.messages;
            commsApp.events = data.events;
            
            commsApp.renderChannels();
            commsApp.renderMembers();
            commsApp.renderEvents();
            commsApp.renderAnnouncements();
            commsApp.updateDashboard();
        });

        // New message received
        this.socket.on('new-message', (message) => {
            commsApp.messages.push(message);
            if (commsApp.currentChannel && message.channelId === commsApp.currentChannel.id) {
                commsApp.loadChannelMessages();
            }
            commsApp.showNotification(`New message in ${message.channelId}`, 'info');
        });

        // User joined
        this.socket.on('user-joined', (user) => {
            commsApp.users.push(user);
            commsApp.renderMembers();
            commsApp.updateDashboard();
            commsApp.showNotification(`${user.name} joined the community!`, 'success');
        });

        // User left
        this.socket.on('user-left', (user) => {
            const index = commsApp.users.findIndex(u => u.id === user.id);
            if (index > -1) {
                commsApp.users[index] = user;
                commsApp.renderMembers();
                commsApp.updateDashboard();
            }
        });

        // Users list updated
        this.socket.on('users-update', (users) => {
            commsApp.users = users;
            commsApp.renderMembers();
            commsApp.updateDashboard();
        });

        // New event created
        this.socket.on('new-event', (event) => {
            commsApp.events.push(event);
            commsApp.renderEvents();
            commsApp.showNotification(`New event: ${event.title}`, 'info');
        });

        // Event updated
        this.socket.on('event-updated', (event) => {
            const index = commsApp.events.findIndex(e => e.id === event.id);
            if (index > -1) {
                commsApp.events[index] = event;
                commsApp.renderEvents();
            }
        });

        // User typing indicator
        this.socket.on('user-typing', (data) => {
            commsApp.showTypingIndicator(data.userName, data.channelId);
        });

        this.socket.on('user-stopped-typing', (data) => {
            commsApp.hideTypingIndicator(data.userId, data.channelId);
        });
    }

    joinUser(userData) {
        this.socket.emit('user-join', userData);
    }

    sendMessage(messageData) {
        this.socket.emit('send-message', messageData);
    }

    createEvent(eventData) {
        this.socket.emit('create-event', eventData);
    }

    joinEvent(eventId) {
        this.socket.emit('join-event', eventId);
    }

    leaveEvent(eventId) {
        this.socket.emit('leave-event', eventId);
    }

    startTyping(channelId) {
        this.socket.emit('typing-start', { channelId });
    }

    stopTyping(channelId) {
        this.socket.emit('typing-stop', { channelId });
    }
}

// Update the main CommunityComms class
class CommunityComms {
    constructor() {
        this.currentUser = null;
        this.users = [];
        this.channels = [];
        this.messages = [];
        this.events = [];
        this.currentChannel = null;
        this.currentMessageType = 'text';
        this.realtime = new RealTimeComms();
        
        this.init();
    }

    // Update the setupDefaultUser method
    setupDefaultUser() {
        // Create a random user for demo (in real app, you'd have login)
        const randomId = Math.random().toString(36).substr(2, 9);
        this.currentUser = {
            id: randomId,
            name: `User${randomId.substr(0, 4)}`,
            email: `user${randomId.substr(0, 4)}@community.com`,
            role: 'Member',
            isOnline: true,
            lastSeen: new Date().toISOString()
        };

        document.getElementById('currentUserInfo').textContent = this.currentUser.name;
        
        // Join the real-time platform
        this.realtime.joinUser(this.currentUser);
        
        this.setCurrentChannel('general');
    }

    // Update sendMessage method
    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
        
        if (!content || !this.currentChannel) return;

        this.realtime.sendMessage({
            channelId: this.currentChannel.id,
            content: content,
            type: this.currentMessageType
        });

        messageInput.value = '';
        this.realtime.stopTyping(this.currentChannel.id);
    }

    // Update createEvent method
    createEvent() {
        const title = document.getElementById('eventTitle').value.trim();
        const description = document.getElementById('eventDescription').value.trim();
        const date = document.getElementById('eventDate').value;
        const location = document.getElementById('eventLocation').value.trim();
        
        if (!title || !date || !location) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        this.realtime.createEvent({
            title: title,
            description: description,
            date: date,
            location: location
        });

        document.getElementById('eventForm').reset();
    }

    // Update event attendance methods
    toggleEventAttendance(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        const isAttending = event.attendees.includes(this.currentUser.id);
        if (isAttending) {
            this.realtime.leaveEvent(eventId);
        } else {
            this.realtime.joinEvent(eventId);
        }
    }

    // Add typing indicators
    setupTypingIndicator() {
        const messageInput = document.getElementById('messageInput');
        let typingTimer;

        messageInput.addEventListener('input', () => {
            if (this.currentChannel) {
                this.realtime.startTyping(this.currentChannel.id);
                
                clearTimeout(typingTimer);
                typingTimer = setTimeout(() => {
                    this.realtime.stopTyping(this.currentChannel.id);
                }, 1000);
            }
        });
    }

    showTypingIndicator(userName, channelId) {
        if (this.currentChannel && this.currentChannel.id === channelId) {
            // Add typing indicator to UI
            const typingIndicator = document.getElementById('typingIndicator') || 
                this.createTypingIndicator();
            typingIndicator.textContent = `${userName} is typing...`;
            typingIndicator.style.display = 'block';
        }
    }

    hideTypingIndicator(userId, channelId) {
        if (this.currentChannel && this.currentChannel.id === channelId) {
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) {
                typingIndicator.style.display = 'none';
            }
        }
    }

    createTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.className = 'typing-indicator';
        indicator.style.display = 'none';
        document.getElementById('messagesContainer').appendChild(indicator);
        return indicator;
    }
}

class CommunityComms {
    constructor() {
        this.currentUser = null;
        this.users = [];
        this.channels = [];
        this.messages = [];
        this.events = [];
        this.currentChannel = null;
        this.currentMessageType = 'text';
        
        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.setupDefaultUser();
        this.updateDashboard();
        this.showNotification('Welcome to Community Communication Platform!', 'success');
    }

    async loadData() {
        try {
            // Load users
            const usersResponse = await fetch('users.json');
            this.users = await usersResponse.json();
            
            // Load channels
            const channelsResponse = await fetch('channels.json');
            this.channels = await channelsResponse.json();
            
            // Load messages
            const messagesResponse = await fetch('messages.json');
            this.messages = await messagesResponse.json();
            
            // Load events
            const eventsResponse = await fetch('events.json');
            this.events = await eventsResponse.json();
            
            this.renderChannels();
            this.renderMembers();
            this.renderEvents();
            this.renderAnnouncements();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data. Using sample data.', 'error');
            this.loadSampleData();
        }
    }

    loadSampleData() {
        // Sample users
        this.users = [
            {
                id: '1',
                name: 'Community Admin',
                email: 'admin@community.com',
                role: 'Admin',
                isOnline: true,
                lastSeen: new Date().toISOString()
            },
            {
                id: '2',
                name: 'Event Coordinator',
                email: 'events@community.com',
                role: 'Moderator',
                isOnline: true,
                lastSeen: new Date().toISOString()
            },
            {
                id: '3',
                name: 'John Deng',
                email: 'john@community.com',
                role: 'Member',
                isOnline: true,
                lastSeen: new Date().toISOString()
            },
            {
                id: '4',
                name: 'Sarah Akech',
                email: 'sarah@community.com',
                role: 'Member',
                isOnline: false,
                lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            }
        ];

        // Sample channels
        this.channels = [
            {
                id: 'general',
                name: 'General',
                description: 'General community discussions',
                type: 'general',
                members: ['1', '2', '3', '4']
            },
            {
                id: 'announcements',
                name: 'Announcements',
                description: 'Important community announcements',
                type: 'announcements',
                members: ['1', '2', '3', '4']
            },
            {
                id: 'events',
                name: 'Events',
                description: 'Community events and activities',
                type: 'events',
                members: ['1', '2', '3', '4']
            }
        ];

        // Sample messages
        this.messages = [
            {
                id: '1',
                userId: '1',
                channelId: 'general',
                content: 'Welcome to our community communication platform! 👋',
                type: 'announcement',
                timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString()
            },
            {
                id: '2',
                userId: '3',
                channelId: 'general',
                content: 'Hello everyone! Great to be part of this community.',
                type: 'text',
                timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
            }
        ];

        // Sample events
        this.events = [
            {
                id: '1',
                title: 'Community Meeting',
                description: 'Monthly community gathering to discuss important matters',
                date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                location: 'Community Center',
                organizer: '1',
                attendees: ['1', '2']
            }
        ];

        this.renderChannels();
        this.renderMembers();
        this.renderEvents();
        this.renderAnnouncements();
    }

    setupDefaultUser() {
        this.currentUser = this.users[0]; // Set first user as current
        document.getElementById('currentUserInfo').textContent = this.currentUser.name;
        this.setCurrentChannel(this.channels[0].id);
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.closest('.nav-btn').dataset.section;
                this.showSection(section);
            });
        });

        // Message sending
        document.getElementById('sendMessageBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Event form
        document.getElementById('eventForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createEvent();
        });

        // Member search
        document.getElementById('memberSearch').addEventListener('input', (e) => {
            this.searchMembers(e.target.value);
        });
    }

    showSection(sectionName) {
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === sectionName) {
                btn.classList.add('active');
            }
        });

        // Show selected section
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionName).classList.add('active');

        // Refresh section data
        switch(sectionName) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'chat':
                this.loadChannelMessages();
                break;
            case 'members':
                this.renderMembers();
                break;
            case 'events':
                this.renderEvents();
                break;
            case 'announcements':
                this.renderAnnouncements();
                break;
        }
    }

    setCurrentChannel(channelId) {
        this.currentChannel = this.channels.find(c => c.id === channelId);
        
        // Update UI
        document.querySelectorAll('.channel-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.channelId === channelId) {
                btn.classList.add('active');
            }
        });

        document.getElementById('currentChannelName').innerHTML = 
            `<i class="fas fa-comments"></i> ${this.currentChannel.name}`;
        document.getElementById('channelInfo').textContent = this.currentChannel.description;

        this.loadChannelMessages();
        this.showSection('chat');
    }

    renderChannels() {
        const channelsList = document.getElementById('channelsList');
        channelsList.innerHTML = this.channels.map(channel => `
            <button class="channel-btn ${this.currentChannel?.id === channel.id ? 'active' : ''}" 
                    data-channel-id="${channel.id}"
                    onclick="commsApp.setCurrentChannel('${channel.id}')">
                <i class="fas fa-hashtag"></i> ${channel.name}
            </button>
        `).join('');
    }

    loadChannelMessages() {
        if (!this.currentChannel) return;

        const channelMessages = this.messages.filter(msg => msg.channelId === this.currentChannel.id);
        const messagesContainer = document.getElementById('messagesContainer');
        
        messagesContainer.innerHTML = channelMessages.map(msg => {
            const user = this.users.find(u => u.id === msg.userId);
            const time = new Date(msg.timestamp).toLocaleTimeString();
            
            return `
                <div class="message ${msg.type}">
                    <div class="message-header">
                        <div>
                            <span class="message-sender">${user?.name || 'Unknown'}</span>
                            <span class="message-role">${user?.role || 'Member'}</span>
                        </div>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-content">${msg.content}</div>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
        
        if (!content || !this.currentChannel) return;

        const newMessage = {
            id: Date.now().toString(),
            userId: this.currentUser.id,
            channelId: this.currentChannel.id,
            content: content,
            type: this.currentMessageType,
            timestamp: new Date().toISOString()
        };

        this.messages.push(newMessage);
        this.loadChannelMessages();
        messageInput.value = '';
        
        this.showNotification('Message sent!', 'success');
    }

    setMessageType(type) {
        this.currentMessageType = type;
        
        // Update UI
        document.querySelectorAll('.msg-action-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    }

    renderMembers() {
        const membersGrid = document.getElementById('membersGrid');
        const searchQuery = document.getElementById('memberSearch').value.toLowerCase();
        
        const filteredMembers = this.users.filter(user => 
            user.name.toLowerCase().includes(searchQuery) ||
            user.email.toLowerCase().includes(searchQuery) ||
            user.role.toLowerCase().includes(searchQuery)
        );

        membersGrid.innerHTML = filteredMembers.map(user => {
            const lastSeen = new Date(user.lastSeen);
            const isOnline = user.isOnline;
            const statusText = isOnline ? 'Online now' : `Last seen: ${lastSeen.toLocaleTimeString()}`;
            
            return `
                <div class="member-card">
                    <div class="member-header">
                        <div class="member-name">${user.name}</div>
                        <div class="member-status ${isOnline ? 'status-online' : 'status-offline'}">
                            <i class="fas fa-circle"></i>
                            ${isOnline ? 'Online' : 'Offline'}
                        </div>
                    </div>
                    <div class="member-role">${user.role}</div>
                    <div class="member-email">${user.email}</div>
                    <div class="member-last-seen">${statusText}</div>
                </div>
            `;
        }).join('');
    }

    searchMembers(query) {
        this.renderMembers();
    }

    renderEvents() {
        const eventsList = document.getElementById('eventsList');
        const upcomingEvents = this.events.filter(event => new Date(event.date) > new Date());
        
        eventsList.innerHTML = upcomingEvents.map(event => {
            const organizer = this.users.find(u => u.id === event.organizer);
            const eventDate = new Date(event.date);
            const isAttending = event.attendees.includes(this.currentUser.id);
            
            return `
                <div class="event-card">
                    <div class="event-header">
                        <div class="event-title">${event.title}</div>
                        <div class="event-date">${eventDate.toLocaleDateString()} at ${eventDate.toLocaleTimeString()}</div>
                    </div>
                    <div class="event-description">${event.description}</div>
                    <div class="event-details">
                        <span>📍 ${event.location}</span>
                        <span>👥 ${event.attendees.length} attending</span>
                    </div>
                    <button class="join-btn ${isAttending ? 'joined' : ''}" 
                            onclick="commsApp.toggleEventAttendance('${event.id}')">
                        ${isAttending ? '✓ Joined' : 'Join Event'}
                    </button>
                </div>
            `;
        }).join('');

        // Update dashboard count
        document.getElementById('statUpcomingEvents').textContent = upcomingEvents.length;
    }

    createEvent() {
        const title = document.getElementById('eventTitle').value.trim();
        const description = document.getElementById('eventDescription').value.trim();
        const date = document.getElementById('eventDate').value;
        const location = document.getElementById('eventLocation').value.trim();
        
        if (!title || !date || !location) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        const newEvent = {
            id: Date.now().toString(),
            title: title,
            description: description,
            date: new Date(date).toISOString(),
            location: location,
            organizer: this.currentUser.id,
            attendees: [this.currentUser.id]
        };

        this.events.push(newEvent);
        this.renderEvents();
        document.getElementById('eventForm').reset();
        
        this.showNotification('Event created successfully!', 'success');
    }

    toggleEventAttendance(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        const attendeeIndex = event.attendees.indexOf(this.currentUser.id);
        if (attendeeIndex > -1) {
            event.attendees.splice(attendeeIndex, 1);
            this.showNotification('You left the event', 'info');
        } else {
            event.attendees.push(this.currentUser.id);
            this.showNotification('You joined the event!', 'success');
        }

        this.renderEvents();
    }

    sendAnnouncement() {
        const announcementText = document.getElementById('announcementText').value.trim();
        if (!announcementText) {
            this.showNotification('Please enter announcement text', 'error');
            return;
        }

        const announcementMessage = {
            id: Date.now().toString(),
            userId: this.currentUser.id,
            channelId: 'announcements',
            content: announcementText,
            type: 'announcement',
            timestamp: new Date().toISOString()
        };

        this.messages.push(announcementMessage);
        document.getElementById('announcementText').value = '';
        this.renderAnnouncements();
        
        this.showNotification('Announcement sent to all members!', 'success');
    }

    renderAnnouncements() {
        const announcementsList = document.getElementById('announcementsList');
        const announcementMessages = this.messages
            .filter(msg => msg.type === 'announcement')
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 10); // Show last 10 announcements

        announcementsList.innerHTML = announcementMessages.map(msg => {
            const user = this.users.find(u => u.id === msg.userId);
            const time = new Date(msg.timestamp).toLocaleString();
            
            return `
                <div class="announcement-card">
                    <div class="announcement-header">
                        <div class="announcement-sender">${user?.name || 'Unknown'}</div>
                        <div class="announcement-time">${time}</div>
                    </div>
                    <div class="announcement-content">${msg.content}</div>
                </div>
            `;
        }).join('');
    }

    updateDashboard() {
        const onlineCount = this.users.filter(user => user.isOnline).length;
        
        document.getElementById('statTotalMembers').textContent = this.users.length;
        document.getElementById('statOnlineNow').textContent = onlineCount;
        document.getElementById('statActiveChannels').textContent = this.channels.length;
        document.getElementById('onlineCount').textContent = onlineCount;

        // Update upcoming events list
        const upcomingEventsList = document.getElementById('upcomingEventsList');
        const upcomingEvents = this.events
            .filter(event => new Date(event.date) > new Date())
            .slice(0, 5);

        upcomingEventsList.innerHTML = upcomingEvents.map(event => {
            const eventDate = new Date(event.date);
            return `
                <div class="event-card">
                    <div class="event-header">
                        <div class="event-title">${event.title}</div>
                        <div class="event-date">${eventDate.toLocaleDateString()}</div>
                    </div>
                    <div class="event-description">${event.description}</div>
                    <div class="event-details">
                        <span>📍 ${event.location}</span>
                        <span>👥 ${event.attendees.length} attending</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        
        notification.className = `notification ${type}`;
        notificationText.textContent = message;
        notification.classList.remove('hidden');
        
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    }

    hideNotification() {
        document.getElementById('notification').classList.add('hidden');
    }
}

// Global functions for HTML onclick handlers
function showSection(sectionName) {
    commsApp.showSection(sectionName);
}

function setMessageType(type) {
    commsApp.setMessageType(type);
}

function sendAnnouncement() {
    commsApp.sendAnnouncement();
}

function hideNotification() {
    commsApp.hideNotification();
}

// Initialize the application
let commsApp;
document.addEventListener('DOMContentLoaded', () => {
    commsApp = new CommunityComms();
});