"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIO = getIO;
exports.initSocket = initSocket;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const events_1 = require("./events");
const Identity_1 = require("../models/Identity");
let io;
function getIO() {
    if (!io)
        throw new Error('Socket.IO nicht initialisiert');
    return io;
}
function initSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
    });
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) {
                next(new Error('Nicht autorisiert'));
                return;
            }
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
            socket.data.userId = payload.userId;
            // 🔒 SECURITY FIX: Identity aus JWT oder validiert
            const requestedIdentityId = socket.handshake.auth?.identityId || payload.activeIdentityId;
            if (requestedIdentityId) {
                // ✅ Validiere: Identity gehört dem User
                const identity = await Identity_1.Identity.findOne({
                    _id: requestedIdentityId,
                    userId: payload.userId
                }).lean();
                if (!identity) {
                    next(new Error('Unauthorized identity'));
                    return;
                }
                socket.data.activeIdentityId = identity._id.toString();
            }
            else {
                // Fallback: Lade aktive Identity
                const ident = await Identity_1.Identity.findOne({ userId: payload.userId, isActive: true }).lean();
                if (ident)
                    socket.data.activeIdentityId = ident._id.toString();
            }
            next();
        }
        catch (_err) {
            next(new Error('Token ungültig'));
        }
    });
    io.on('connection', async (socket) => {
        const userId = socket.data.userId;
        await User_1.User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() });
        io.emit(events_1.EVENTS.USER_STATUS, { userId, status: 'online', lastSeen: new Date() });
        // 🔒 SECURITY FIX: Multi-Identity Notifications
        // ✅ Socket joined ALLE Identity-Räume des Users
        try {
            const userIdentities = await Identity_1.Identity.find({ userId }).lean();
            userIdentities.forEach(identity => {
                const roomName = `identity:${identity._id}`;
                socket.join(roomName);
                console.log(`✅ Socket ${socket.id} joined ${roomName}`);
            });
            // User-Room (für globale Events)
            socket.join(`user:${userId}`);
            console.log(`User ${userId} connected with ${userIdentities.length} identities (active: ${socket.data.activeIdentityId})`);
        }
        catch (err) {
            console.error('Failed to join identity rooms:', err);
        }
        socket.on(events_1.EVENTS.JOIN_CONVERSATION, (conversationId) => {
            socket.join(`conv:${conversationId}`);
        });
        socket.on(events_1.EVENTS.LEAVE_CONVERSATION, (conversationId) => {
            socket.leave(`conv:${conversationId}`);
        });
        socket.on(events_1.EVENTS.TYPING_START, ({ conversationId }) => {
            socket.to(`conv:${conversationId}`).emit(events_1.EVENTS.USER_TYPING, { userId, conversationId });
        });
        socket.on(events_1.EVENTS.TYPING_STOP, ({ conversationId }) => {
            socket.to(`conv:${conversationId}`).emit(events_1.EVENTS.USER_STOP_TYPING, { userId, conversationId });
        });
        // 🔒 SECURITY FIX: Ping mit Identity-Validierung
        socket.on(events_1.EVENTS.PING_USER, async ({ targetUserId, targetIdentityId, senderName }) => {
            // ✅ Prüfe ob Sender-Identity dem Sender gehört
            if (socket.data.activeIdentityId) {
                const senderIdentity = await Identity_1.Identity.findOne({
                    _id: socket.data.activeIdentityId,
                    userId: socket.data.userId
                }).lean();
                if (!senderIdentity) {
                    console.warn(`Invalid sender identity: ${socket.data.activeIdentityId}`);
                    return;
                }
            }
            const sockets = await io.fetchSockets();
            sockets
                .filter(s => {
                if (s.data.userId !== targetUserId)
                    return false;
                // Wenn identityId angegeben: nur an die richtige Identity
                if (targetIdentityId && s.data.activeIdentityId) {
                    return s.data.activeIdentityId === targetIdentityId;
                }
                return true;
            })
                .forEach(s => s.emit(events_1.EVENTS.INCOMING_PING, {
                fromUserId: userId,
                fromIdentityId: socket.data.activeIdentityId,
                senderName
            }));
        });
        // ✅ NEU: Identity-Switch ohne Reconnect
        socket.on('switch_identity', async ({ identityId }) => {
            try {
                // Validiere Identity gehört dem User
                const identity = await Identity_1.Identity.findOne({
                    _id: identityId,
                    userId: socket.data.userId
                }).lean();
                if (!identity) {
                    socket.emit('error', { error: 'Unauthorized identity' });
                    return;
                }
                // Speichere neue aktive Identity
                const oldIdentityId = socket.data.activeIdentityId;
                socket.data.activeIdentityId = identityId;
                // Update isActive in DB
                if (oldIdentityId) {
                    await Identity_1.Identity.findByIdAndUpdate(oldIdentityId, { isActive: false });
                }
                await Identity_1.Identity.findByIdAndUpdate(identityId, { isActive: true });
                socket.emit('identity_switched', {
                    identityId,
                    type: identity.type,
                    label: identity.label
                });
                console.log(`Socket ${socket.id} switched from ${oldIdentityId} to ${identityId}`);
            }
            catch (error) {
                console.error('Identity switch error:', error);
                socket.emit('error', { error: 'Failed to switch identity' });
            }
        });
        // ── WebRTC Signaling (Identity-aware) ────────────────────────────────────
        socket.on('webrtc_offer', ({ to, toIdentityId, offer, conversationId, callerName }) => {
            // ✅ SECURITY: fromIdentityId IMMER vom Server, niemals vom Client
            const fromIdentityId = socket.data.activeIdentityId;
            const targetSocket = [...io.sockets.sockets.values()]
                .find(s => s.data.userId === to && (!toIdentityId || s.data.activeIdentityId === toIdentityId));
            if (targetSocket) {
                targetSocket.emit('incoming_call', {
                    from: socket.data.userId,
                    fromIdentityId, // ← NUR vom Server
                    callerName: callerName || 'Unbekannt',
                    offer,
                    conversationId,
                });
            }
        });
        socket.on('webrtc_answer', ({ to, answer, conversationId }) => {
            // ✅ SECURITY: fromIdentityId serverseitig
            const fromIdentityId = socket.data.activeIdentityId;
            const targetSocket = [...io.sockets.sockets.values()]
                .find(s => s.data.userId === to);
            if (targetSocket) {
                targetSocket.emit('webrtc_answer', {
                    from: socket.data.userId,
                    fromIdentityId, // ← NUR vom Server
                    answer,
                    conversationId,
                });
            }
        });
        socket.on('webrtc_ice', ({ to, candidate, conversationId }) => {
            const targetSocket = [...io.sockets.sockets.values()]
                .find(s => s.data.userId === to);
            if (targetSocket) {
                targetSocket.emit('webrtc_ice', {
                    from: socket.data.userId,
                    candidate,
                    conversationId,
                });
            }
        });
        socket.on('webrtc_hangup', ({ to, conversationId }) => {
            const targetSocket = [...io.sockets.sockets.values()]
                .find(s => s.data.userId === to);
            if (targetSocket) {
                targetSocket.emit('webrtc_hangup', {
                    from: socket.data.userId,
                    conversationId,
                });
            }
        });
        socket.on('disconnect', async () => {
            const sockets = await io.fetchSockets();
            const stillOnline = sockets.some(s => s.data.userId === userId);
            if (!stillOnline) {
                const now = new Date();
                await User_1.User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: now });
                // Auch alle Identity-Status updaten
                try {
                    await Identity_1.Identity.updateMany({ userId }, { status: 'offline' });
                }
                catch (_e) { }
                io.emit(events_1.EVENTS.USER_STATUS, { userId, status: 'offline', lastSeen: now });
            }
        });
    });
    console.log('✅ Socket.IO initialisiert (Multi-Identity Support)');
}
