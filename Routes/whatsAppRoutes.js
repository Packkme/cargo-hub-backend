const express = require('express');
const router = express.Router();
const whatsAppController = require('../controllers/whatsappController');
const passport = require("passport");

router.post('/webhooks/incoming/receive', whatsAppController.incomingWhatsAppReply);
router.post('/webhooks/event/receive', whatsAppController.eventWhatsAppReply);

router.use(passport.authenticate('jwt', { session: false }));

router.get('/getWhatsAppReport', whatsAppController.getWhatsAppReport);
router.post('/sendFeedbackRequests', whatsAppController.sendFeedbackRequests);
router.post('/sendOneOnOneMessage', whatsAppController.sendOneOnOneMessage);
router.post('/conversations', whatsAppController.getAllConversations);
router.post('/conversations/:phoneNumber', whatsAppController.getOneOnOneConversations);

module.exports = router;
