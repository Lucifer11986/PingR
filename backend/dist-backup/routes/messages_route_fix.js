// GET /api/messages/:conversationId — Nachrichten einer Conversation laden
router.get('/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.userId;
        // Prüfe ob User Zugriff auf Conversation hat
        const conv = await Conversation.findOne({
            _id: conversationId,
            participants: userId
        });
        if (!conv) {
            res.status(404).json({ error: 'Conversation nicht gefunden' });
            return;
        }
        // Lade Nachrichten
        const messages = await Message.find({
            conversationId,
            deleted: false
        })
            .populate('sender', 'username avatar')
            .sort({ createdAt: -1 })
            .limit(100);
        res.json(messages.reverse());
    }
    catch (error) {
        console.error('GET messages error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
