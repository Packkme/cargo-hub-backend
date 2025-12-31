const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const routes = require('../Routes/index.js')  
const passport = require('../middleware/passport');
const session = require('express-session');
const AppError = require('../utils/AppError');
const globalErrorHandler = require('../middleware/errorHandler');
const { 
  helmetConfig, 
  sanitizeInput, 
  generalLimiter,
  validateCORS 
} = require('../middleware/security');

app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
  


// Security middleware
app.use(helmetConfig);
app.use(generalLimiter);
app.use(sanitizeInput);

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));


const allowedOrigins = [
  'http://localhost:8080',   
  'http://localhost:8081',   
  'https://packkme.com'      
];



// Configure CORS
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new AppError('Not allowed by CORS', 403, 'CORS_VIOLATION'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(validateCORS);

 // Initialize Passport and restore authentication state from session
 app.use(passport.initialize());
 app.use(passport.session());



// API router
 app.use('/api/', routes);

 


// catch 404 and forward to error handler
app.use('/{*any}', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404, 'ROUTE_NOT_FOUND'));
});

// Global error handling middleware
app.use(globalErrorHandler);



module.exports = app;