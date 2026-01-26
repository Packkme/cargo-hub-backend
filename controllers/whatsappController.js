const requestContext = require('../utils/requestContext');
const logger = require('../utils/logger');
const config = process.env;
const WhatsAppJSONMessage = require('../models/WhatsAppJSONMessage');
const WhatsAppConversation = require('../models/WhatsAppConversation');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const TravelStatus = require('../models/TravelStatus');
const Operator = require('../models/Operator');
const whatsappService = require('../services/whatsappService');
const moment = require('moment');

const XLSX = require('xlsx');
const fs = require('fs');

exports.getWhatsAppReport = async (req, res) => {
    try {
        const operatorId = requestContext.getOperatorId();
        console.log(operatorId);
        if (!operatorId) {
            return res.status(400).json({ error: 'Operator ID is required' });
        }

        // Aggregate to get count of template messages (incoming: false) by phone number
        const reportData = await WhatsAppConversation.aggregate([
            { $match: { operatorId } },
            { $unwind: '$messages' },
            { $match: { 'messages.incoming': false } },
            {
                $group: {
                    _id: '$phoneNumber',
                    phoneNumber: { $first: '$phoneNumber' },
                    templateMessageCount: { $sum: 1 },
                    lastMessageDate: { $max: '$messages.sentAt' }
                }
            },
            { $sort: { lastMessageDate: -1 } }
        ]);

        if (reportData.length === 0) {
            return res.status(404).json({ message: 'No template messages found' });
        }

        // Format data for Excel
        const formattedData = reportData.map(item => ({
            'Phone Number': item.phoneNumber ? item.phoneNumber.replace(/^91/, '') : 'N/A',
            'Messages Sent': item.templateMessageCount,
            'Last Message Date': item.lastMessageDate ? new Date(item.lastMessageDate).toLocaleString() : 'N/A'
        }));

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(formattedData);
        
        // Set column widths
        const wscols = [
            { wch: 20 }, // Phone Number
            { wch: 20 }, // Template Messages
            { wch: 25 }  // Last Message Date
        ];
        ws['!cols'] = wscols;

        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'WhatsApp Template Messages');

        // Generate Excel file
        const fileName = `whatsapp_template_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        const filePath = `./temp/${fileName}`;
        
        // Ensure temp directory exists
        if (!fs.existsSync('./temp')) {
            fs.mkdirSync('./temp');
        }

        // Write a file
        XLSX.writeFile(wb, filePath);

        // Send the file for download
        res.download(filePath, fileName, (err) => {
            if (err) {
                logger.error('Error sending WhatsApp report file', { error: err.message });
                return res.status(500).json({ error: 'Error downloading report' });
            }
            // Delete the temporary file after sending
            fs.unlinkSync(filePath);
        });

    } catch (error) {
        logger.error('Error generating WhatsApp report', { error: error.message, stack: error.stack });
        res.status(400).json({
            error: 'Failed to generate WhatsApp report',
            message: error.message
        });
    }
};

exports.incomingWhatsAppReply = async (req, res) => {
    try {
        logger.info('processing incoming whatsapp reply');
        logger.info('Request Headers:', req.headers);
        logger.info('Request Body:', req.body);

        processIncomingMessage(req.body);
        
        // Send a simple response
        return res.status(200).json({
            status: 'success',
            message: 'Webhook received successfully'
        });
    } catch (error) {
        logger.error('Error in incomingWhatsAppReply:', error);
        return res.status(400).json({ error: error.message });
    }
};

exports.eventWhatsAppReply = async (req, res) => {
    try {
        logger.info('processing event whatsapp reply');
        logger.info('Request Headers:', req.headers);
        logger.info('Request Body:', req.body);


        processEvent(req.body);
        
        // Send a simple response
        return res.status(200).json({
            status: 'success',
            message: 'Webhook received successfully'
        });
    } catch (error) {
        logger.error('Error in eventWhatsAppReply:', error);
        return res.status(400).json({ error: error.message });
    }
};

exports.sendFeedbackRequests = async (req, res) => {
    try {
        const { pnrs } = req.body;
        const operatorId = requestContext.getOperatorId();

        if (!pnrs || !Array.isArray(pnrs) || pnrs.length === 0) {
            return res.status(400).json({ error: 'pnrs array is required' });
        }

        const travelStatuses = await TravelStatus.find({ pnr: { $in: pnrs } }).populate('operatorId');

        const results = [];

        const sentContacts = new Set();

        for (const status of travelStatuses) {
            const dedupeKey = `${status.pnr}_${status.passengerContact}`;
            if (sentContacts.has(dedupeKey)) {
                results.push({
                    pnr: status.pnr,
                    skipped: true,
                    reason: 'Duplicate passenger contact for same PNR'
                });
                continue;
            }
            sentContacts.add(dedupeKey);

            // Determine operator and config
            let currentOperatorId = operatorId;
            let currentOperatorConfig = {};
            if (status.operatorId && status.operatorId._id) {
                currentOperatorId = status.operatorId._id;
                currentOperatorConfig = status.operatorId.whatsappConfig || {};
            } else if (operatorId) {
                const operator = await Operator.findById(operatorId);
                currentOperatorConfig = operator?.whatsappConfig || {};
            }

            const whatsappMessage = `Dear ${status.passengerName} garu, thank you for traveling with Srikrishna Travels. Hope you liked traveling with us. || Yes I liked it || No I have a complaint`;
            if (status.passengerContact && status.passengerName) {
                const response = await whatsappService.sendWhatsAppTemplateMessage(
                    status.passengerContact,
                    currentOperatorConfig.feedbackTemplateName,
                    [status.passengerName],
                    null,
                    currentOperatorConfig
                );
                results.push({
                    pnr: status.pnr,
                    success: response.success,
                    data: response.data || response.error
                });

                const cities = status.route.split('-') || [];

                const feedbackRequest = {
                    id: status?._id,
                    pnr: status.pnr,
                    fromCity: cities ? cities[0].trim().toString() : null,
                    toCity: cities ? cities[1].trim().toString() : null,
                    travelDates: status.tripDate ? moment(status.tripDate).format('YYYY-MM-DD') : null,
                    operatorId: currentOperatorId,
                    receiverName: status?.passengerName,
                    receiverPhone: status?.passengerContact
                };
                await whatsappService.saveWhatsAppConversations(
                    whatsappMessage,
                    feedbackRequest,
                    response,
                    WhatsAppConversation.BOOKING_FEEDBACK,
                    currentOperatorConfig
                );
            } else {
                results.push({
                    pnr: status.pnr,
                    success: false,
                    message: 'Missing passenger name or contact'
                });
            }
        }

        return res.status(200).json({ results });
    } catch (error) {
        logger.error('Error sending feedback requests:', error);
        return res.status(500).json({ error: error.message });
    }
};

exports.sendOneOnOneMessage = async (req, res) => {
    try {
        const { mobileNumber, content } = req.body;
        const operatorId = requestContext.getOperatorId();

        if (!mobileNumber || !content) {
            return res.status(400).json({ error: 'mobileNumber and content are required' });
        }

        let operatorConfig = {};
        if (operatorId) {
            const operator = await Operator.findById(operatorId);
            operatorConfig = operator?.whatsappConfig || {};
        }

        const response = await whatsappService.sendWhatsAppTextMessage(mobileNumber, content, operatorConfig);

        if (response.success) {
            const bookingReferenceData = {
                receiverPhone: mobileNumber,
                receiverName: mobileNumber, // Default to mobile number if name not provided
                operatorId: operatorId
            };

            await whatsappService.saveWhatsAppConversations(
                content,
                bookingReferenceData,
                response,
                WhatsAppConversation.BOOKING_FEEDBACK,
                operatorConfig
            );

            return res.status(200).json({ success: true, data: response.data });
        } else {
            return res.status(500).json({ success: false, error: response.error });
        }
    } catch (error) {
        logger.error('Error sending one on one message:', error);
        return res.status(500).json({ error: error.message });
    }
};

exports.getAllConversations = async (req, res) => {
  try {
    const operatorId = requestContext.getOperatorId();

    if (!operatorId) {
      return res.status(400).json({ error: 'Operator ID is required' });
    }

    const {
      search,       
      isComplaint,   
      fromCity,     
      toCity        
    } = req.body;

    const filter = {
      operatorId,
      referenceType: WhatsAppConversation.BOOKING_FEEDBACK
    };

    if (search) {
      filter.phoneNumber = { $regex: search, $options: 'i' };
    }

    if (typeof isComplaint === 'boolean') {
      filter.complaint = isComplaint;
    }

    if (fromCity && fromCity !== 'all') {
      filter.fromCities = fromCity;
    }

    if (toCity && toCity !== 'all') {
      filter.toCities = toCity;
    }

    const conversations = await WhatsAppConversation
      .find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    const formattedConversations = conversations.map(convo => ({
      ...convo,
      messages: convo.messages.map(msg => ({
        ...msg,
        sentAt: msg.sentAt
          ? moment(msg.sentAt)
              .utcOffset('+05:30')
              .format('YYYY-MM-DD HH:mm A')
          : msg.sentAt
      }))
    }));

    return res.status(200).json(formattedConversations);

  } catch (error) {
    logger.error('Error getting all conversations:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.getOneOnOneConversations = async (req, res) => {
    try {
        const operatorId = requestContext.getOperatorId();
        const phoneNumber = req.params.phoneNumber;

        if (!operatorId) {
            return res.status(400).json({ error: 'Operator ID is required' });
        }

        const conversation = await WhatsAppConversation.findOne({
            operatorId,
            referenceType: WhatsAppConversation.BOOKING_FEEDBACK,
            phoneNumber
        }).select('messages').lean();

        if (!conversation) {
            return res.status(200).json([]);
        }

        const messages = conversation.messages.map(msg => ({
            ...msg,
            sentAt: msg.sentAt ? moment(msg.sentAt).utcOffset('+05:30').format('YYYY-MM-DD HH:mm A') : msg.sentAt
        }));

        return res.status(200).json(messages);
    } catch (error) {
        logger.error('Error getting one-on-one conversations:', error);
        return res.status(500).json({ error: error.message });
    }
};

const processEvent = async (event) => {
    try {
        const { delivery_status } = event;
        if (!delivery_status || !Array.isArray(delivery_status)) {
            logger.warn('No delivery status data found in event');
            return;
        }

        for (const status of delivery_status) {
            const { ncmessage_id, status: eventStatus } = status;
            if (!ncmessage_id) {
                logger.warn('No message ID found in delivery status');
                continue;
            }

            // Find or create WhatsAppJSONMessage
            const message = await WhatsAppJSONMessage.findOneAndUpdate(
                { messageId: ncmessage_id },
                { $addToSet: { status: eventStatus, events: JSON.stringify(status) } },
                { upsert: true, new: true }
            );

            logger.info('WhatsApp delivery status processed', {
                messageId: ncmessage_id,
                status: eventStatus,
                eventStatusCount: message.status.length,
                eventCount: message.events.length
            });
        }
    } catch (error) {
        logger.error('Error in processEvent:', {
            error: error.message,
            stack: error.stack,
            event
        });
    }
};

const processIncomingMessage = async (message) => {
    try {
        const { incoming_message } = message;
        if (!incoming_message || !Array.isArray(incoming_message)) {
            logger.warn('No incoming messages found in event');
            return;
        }

        for (const msg of incoming_message) {
            if (!msg.from) {
                logger.warn('No sender found in incoming message');
                continue;
            }

            // Extract receiver phone number (Operator's number)
            const receiverPhone = msg.to;
            let operatorId = null;

            if (receiverPhone) {
                const operator = await Operator.findOne({
                    $or: [
                        { 'whatsappConfig.phoneNumber': receiverPhone },
                        { 'whatsappConfig.phoneNumber': receiverPhone.replace(/^91/, '') }
                    ]
                });

                if (operator) {
                    operatorId = operator._id;
                } else {
                    logger.warn(`No operator found for receiver phone: ${receiverPhone}`);
                }
            }

            // Create WhatsAppMessage
            const whatsAppMessage = new WhatsAppMessage.model({
                message: msg.text_type?.text || '',
                incoming: true,
                response: JSON.stringify(msg),
                sentBy: msg.from,
                sentByUserName: msg.from_name
            });

            // Find or create conversation
            const phoneNumber = msg.from;
            const query = { phoneNumber };

            // If operatorId is found, include it in the query to find the specific conversation
            if (operatorId) {
                query.operatorId = operatorId;
            }
            let existingConversation = await WhatsAppConversation.findOne(query).sort({ updatedAt: -1 });

            if (existingConversation) {
                existingConversation.messages.push(whatsAppMessage);
                await existingConversation.save();
            } else {
                const newConversation = new WhatsAppConversation({
                    name: msg.from_name || phoneNumber,
                    messages: [ whatsAppMessage ],
                    phoneNumber,
                    from: receiverPhone || config.NETCORE_PHONE_NUMBER,
                    replyPending: true,
                    operatorId: operatorId
                });
                await newConversation.save();
            }

            await whatsAppMessage.save();

            logger.info('WhatsApp incoming message processed', { msg, operatorId });
        }
    } catch (error) {
        logger.error('Error in processIncomingMessage:', {
            error: error.message,
            stack: error.stack,
            message
        });
    }
};
