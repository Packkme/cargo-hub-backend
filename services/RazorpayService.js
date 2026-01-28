const axios = require('axios');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/aws');
const logger = require('../utils/logger');
const Booking = require('../models/Booking');
const config = process.env;

class RazorpayService {

  static API_URL = config.RAZORPAY_API_URL;
  static API_KEY = config.RAZORPAY_KEY_ID;
  static API_SECRET = config.RAZORPAY_KEY_SECRET;

  static async generateQRCodeForBooking(bookingId, userId, operatorId, amount, lrType) {
    try {
      logger.info('Received request to generate QR code for booking', { bookingId, userId, operatorId, amount });
      const qrData = await this.generateQR(bookingId, userId, operatorId, amount, lrType);

      logger.info('QR code generated successfully', { bookingId, qrData });
      
      // Update booking with QR code details
      const booking = await Booking.findOneAndUpdate(
        { bookingId },
        {
          qr_code_id: qrData.qr_code_id,
          qr_image_url: qrData.qr_image_url,
          qr_image_location: qrData.qr_image_location
        },
        { new: true }
      );

      if (!booking) {
        throw new Error('Booking not found');
      }

      logger.info('Booking updated with QR code details', { bookingId, qrData });

      return {
        success: true,
        qr_image_url: qrData.qr_image_url,
        qr_code_id: qrData.qr_code_id,
        qr_image_location: qrData.qr_image_location
      };
    } catch (error) {
      logger.error('Error in generateQRCodeForBooking', { 
        bookingId,
        error: error.message 
      });
      throw error;
    }
  }

  static async generateQR(bookingId, userId, operatorId, amount, lrType) {
    try {
      const closeTime = Math.floor(Date.now() / 1000) + (30 * 60); // Current time + 30 minutes
      logger.info('Generating QR code for booking', { bookingId, userId, operatorId, amount, closeTime });
      
      // Create the request body exactly as in Postman
      const requestBody = {
        type: 'upi_qr',
        name: 'Cargo Booking Payment',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: amount * 100, // Amount in paise
        description: `Cargo Booking Payment for Booking ${bookingId}`,
        notes: {
          purpose: 'Cargo Payment QR Code',
          bookingId: bookingId,
          operatorId: operatorId,
          userId: userId,
          lrType: lrType
        }
      };

      // Add close_by if specified
      if (closeTime) {
        requestBody.close_by = closeTime;
      }

      // Log the request details
      logger.info('Making QR code request', {
        url: this.API_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: requestBody
      });

      // Make the request
      const response = await axios.post(
        this.API_URL,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          auth: {
            username: this.API_KEY,
            password: this.API_SECRET
          }
        }
      );

      logger.info('QR code creation response form razorpay', { response: response.data });

      if (response.status !== 200) {
        logger.error('Failed to generate QR code', { error: response.data.error });
        throw new Error('Failed to generate QR code');
      }

      const qrData = response.data;
      
      // Download QR code image
      const imageResponse = await axios.get(qrData.image_url, { responseType: 'arraybuffer' });

      const fileName = `qr_codes/${bookingId}_${Date.now()}.png`;
      const params = {
        Bucket: config.RZP_BUCKET_NAME,
        Key: fileName,
        Body: imageResponse.data,
        ContentType: 'image/png',
        ACL: 'public-read'
      };

      await s3Client.send(new PutObjectCommand(params));
      const location = `${config.bucket_endpoint}/${params.Bucket}/${params.Key}`;

      logger.info('QR code uploaded to S3', { location });

      return {
        qr_code_id: qrData.id,
        qr_image_url: qrData.image_url,
        qr_image_location: location
      };
    } catch (error) {
      logger.error('Error in generateQR', error );
      throw error;
    }
  }
}

module.exports = RazorpayService;
