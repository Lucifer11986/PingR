"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Poll_1 = require("../models/Poll");
const mongoose_1 = require("mongoose");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// POST /api/polls — Umfrage erstellen
router.post('/', async (req, res) => {
    try {
        const { conversationId, question, options, multipleChoice, endsAt } = req.body;
        if (!question?.trim() || !options || options.length < 2) {
            res.status(400).json({ error: 'Frage und mind. 2 Optionen erforderlich' });
            return;
        }
        if (options.length > 10) {
            res.status(400).json({ error: 'Max. 10 Optionen' });
            return;
        }
        const poll = await Poll_1.Poll.create({
            conversationId,
            createdBy: req.userId,
            question: question.trim(),
            options: options.map((o) => ({ text: o.trim(), votes: [] })),
            multipleChoice: !!multipleChoice,
            endsAt: endsAt ? new Date(endsAt) : undefined,
        });
        const populated = await poll.populate('createdBy', 'username uin');
        res.status(201).json(populated);
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// GET /api/polls/:id
router.get('/:id', async (req, res) => {
    try {
        const poll = await Poll_1.Poll.findById(req.params.id).populate('createdBy', 'username');
        if (!poll) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        res.json(poll);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
// POST /api/polls/:id/vote — Abstimmen
router.post('/:id/vote', async (req, res) => {
    try {
        const { optionIndexes } = req.body; // Array von Indizes
        const poll = await Poll_1.Poll.findById(req.params.id);
        if (!poll) {
            res.status(404).json({ error: 'Nicht gefunden' });
            return;
        }
        if (poll.endsAt && poll.endsAt < new Date()) {
            res.status(400).json({ error: 'Umfrage beendet' });
            return;
        }
        const userId = new mongoose_1.Types.ObjectId(req.userId);
        const indexes = Array.isArray(optionIndexes) ? optionIndexes : [optionIndexes];
        // Wenn keine Mehrfachauswahl: erst alle vorherigen Votes entfernen
        if (!poll.multipleChoice) {
            poll.options.forEach(opt => {
                opt.votes = opt.votes.filter(v => v.toString() !== req.userId);
            });
        }
        // Vote setzen
        indexes.forEach(idx => {
            if (idx >= 0 && idx < poll.options.length) {
                const already = poll.options[idx].votes.some(v => v.toString() === req.userId);
                if (!already) {
                    poll.options[idx].votes.push(userId);
                }
                else {
                    // Toggle: nochmal klicken = Stimme entfernen
                    poll.options[idx].votes = poll.options[idx].votes.filter(v => v.toString() !== req.userId);
                }
            }
        });
        await poll.save();
        res.json(poll);
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// GET /api/polls/conversation/:convId — Alle Polls einer Conversation
router.get('/conversation/:convId', async (req, res) => {
    try {
        const polls = await Poll_1.Poll.find({ conversationId: req.params.convId })
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });
        res.json(polls);
    }
    catch (_err) {
        res.status(500).json({ error: 'Serverfehler' });
    }
});
exports.default = router;
