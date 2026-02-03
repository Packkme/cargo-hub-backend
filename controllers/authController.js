const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const Operator = require('../models/Operator');
const Role = require('../models/Role');
const Branch = require('../models/Branch');
const smsService = require('../services/SMSService');
const config = process.env;
const axios = require('axios');

const baseUrl = config.WHATSAPP_MESSAGE_URL;
const apiToken = config.WHATSAPP_API_TOKEN;

// Register Controller
exports.register = async (req, res) => {

  const { fullName, mobile, password } = req.body;

  try {
    // Check if mobile already exists
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({ message: 'Mobile number already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      fullName,
      mobile,
      password: hashedPassword,
    });

    // Save user to database
    await newUser.save();

    res.status(200).json({ message: 'User registered successfully' });
  } catch (error) {
    logger.error('Register Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Login Controller
exports.login = async (req, res) => {
  const { mobile, password } = req.body;

  if (!mobile || !password) {
    return res.status(400).json({ message: 'Mobile number and password are required' });
  }

  try {

    const user = await User.findOne({ mobile })
    .populate('role', 'rolename')
    .populate('branchId', 'name');
    if (!user) {
      return res.status(400).json({ message: 'Mobile number not found' });
    }

    // const user = await User.findOne({ mobile });
    // if (!user) {
    //   return res.status(400).json({ message: 'Mobile number not found' });
    // }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    const token = jwt.sign(
      { _id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    user.token = token;
    await user.save();
     let paymentOptions = [];
    if (user.operatorId) {
      const operator = await Operator.findById(user.operatorId);
      paymentOptions = operator?.paymentOptions || [];
    }


    res.status(200).json({
      status: 200,
      mobile: user.mobile,
      id: user._id,
      fullName: user.fullName,
      token: token,
      role: user.role?.rolename  || null,
      operatorId: user.operatorId,
      branch: user.branchId ? { id: user.branchId._id, name: user.branchId.name } : null,
      paymentOptions,
      message: 'LOGGED_IN_SUCCESSFULLY'
    });
  } catch (error) {
    logger.error('LOGIN_ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.loginWithOTP = async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) return res({status: 500, error: 'Mobile number is required' });

  let user = await User.findOne({ mobile });

  logger.info('User found:', user);
    
    if (!user) {
      return res.status(400).json({ message: 'Mobile number not found' });
    } else if (user && user.status.toLowerCase() === 'inactive') {
      return res.status(400).json({ message: 'User is inactive'});
    }

  try {
      const { OTP, isStatic } = await smsService.validateAndCreateOTP(mobile);

      if (!isStatic) {
          // Sending OTP via SMS
          const requestBody = {
            "message": [
                {
                    "recipient_whatsapp": `91${mobile}`,
                    "message_type": "media_template",
                    "recipient_type": "individual",
                    "type_media_template": {
                        "type": "text",
                        "button": [
                            {
                                "index": "0",
                                "payload": OTP
                            }
                        ]
                    },
                    "type_template": [
                        {
                            "name": "otp_netcore",
                            "attributes": [
                                OTP
                            ],
                            "language": {
                                "locale": "en",
                                "policy": "deterministic"
                            }
                        }
                    ]
                }
            ]
        };

        const response = await axios.post(`${baseUrl}`, requestBody, {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
          }
        });  
        logger.info("SMS Response:", response.data);
      }
      return res.status(200).json({message: 'OTP sent successfully.'});
  } catch (error) {
      logger.error("Error sending OTP:", error);
      return res.status(400).json({message: 'Failed to send OTP.'})
  }
};

async function generateToken(user) {
  try {
      return jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
  } catch (err) {
      logger.error('TOKEN_ERROR:', err);
      throw err;
  }
}

exports.verifyOTP = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);//.populate('role', 'rolename').populate('branchId', 'name');
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }
    
    let paymentOptions = [];
    if (user.operatorId) {
      const operator = await Operator.findById(user.operatorId);
      paymentOptions = operator?.paymentOptions || [];
    }
    logger.info("User role found: here  role: " + user.role + " branchId: " + user.branchId +" operatorId: " + user.operatorId);
    
    const token = await generateToken(user);
    let roleName = user.role?.rolename || null;
    if (!roleName && user.role) {
      const roleDoc = await Role.findById(user.role).select('rolename');
      roleName = roleDoc?.rolename || null;
    }

    let branch = null;
    if (user.branchId) {
      if (typeof user.branchId === 'object' && user.branchId._id) {
        branch = { id: user.branchId._id, name: user.branchId.name };
      } else {
        const branchDoc = await Branch.findById(user.branchId).select('name');
        if (branchDoc) {
          branch = { id: branchDoc._id, name: branchDoc.name };
        }
      }
    }

    res.status(200).json({
      mobile: user.mobile,
      id: user._id,
      fullName: user.fullName,
      token: token,
      role: roleName,
      roleId: user.role?._id || user.role || null,
      operatorId: user.operatorId,
      branchId: user.branchId?._id || user.branchId || null,
      branch,
      paymentOptions,
      message: "LOGGED_IN_SUCCESSFULLY"
    });
  } catch (error) {
    logger.error('VERIFY_OTP_ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
