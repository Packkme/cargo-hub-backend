---
description: 
alwaysApply: true
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- Start the server: `npm start` or `node app.js`
- Development mode: `npm run dev` (uses nodemon)
- The server runs on the port specified by `APP_RUNNING_PORT` environment variable

### Testing
- Run all tests: `npm test`
- Run tests with coverage: `npm run test:coverage`
- Run integration tests: `npm run test:integration`
- Run unit tests: `npm run test:unit`
- Watch mode: `npm run test:watch`
- Jest config includes comprehensive coverage collection and multi-tenant isolation tests

### Database
- Uses MongoDB with Mongoose ODM
- Database connection configured in `database/mongoose.js`
- Run migrations: `npm run migrate`
- Rollback migrations: `npm run migrate:rollback <version>`
- Seed data: `npm run seed`

## Architecture Overview

This is a Node.js/Express cargo management backend with the following structure:

### Core Components
- **Models** (`models/`): Mongoose schemas for core entities
  - Booking, Branch, User, Operator, Vehicle, Transaction, CashTransfer, Role, Permission
- **Services** (`services/`): Business logic layer containing core operations
  - BookingService, BranchService, UserService, OperatorService, etc.
- **Controllers** (`controllers/`): Request handlers that use services
- **Routes** (`Routes/`): Express route definitions, centralized in `Routes/index.js`

### Key Features
- Multi-tenant cargo booking system with operator-based isolation
- Role-based authentication using Passport.js (JWT and local strategies)
- Event history tracking for bookings (loaded, unloaded, delivered, cancelled)
- Cash transfer and transaction management
- E-way bill integration
- Shipment tracking
- Report generation (booking and branch reports)
- Export functionality (CSV, Excel via json2csv and xlsx)

### Authentication & Authorization
- Uses Passport.js with JWT and local strategies
- Request context middleware tracks user context
- Role-based permissions system with Permission and Role models

### Data Flow
1. Routes receive requests and validate authentication
2. Controllers handle request/response logic
3. Services contain business logic and database operations
4. Models define data structure and validation

### Environment Configuration
- Requires `.env` file with configuration including:
  - `APP_RUNNING_PORT`: Server port
  - `NODE_ENV`: Environment (development/production)
  - Database connection strings
  - JWT secrets

### Logging
- Winston logger configured in `utils/logger.js`
- Logs stored in `logs/` directory (combined.log, error.log)
- Request logging middleware logs all HTTP requests

### Key Business Logic
- Multi-operator system where each operator has their own branches, users, and bookings
- Booking workflow includes event history tracking
- Financial transactions linked to bookings and cash transfers
- Vehicle assignment and tracking capabilities

## Security & Quality Features

### Error Handling
- Standardized error handling with `AppError` class and global error middleware
- Consistent API response format with proper status codes and error codes
- Request correlation IDs for tracking errors across logs

### Input Validation
- Joi-based input validation for all API endpoints
- Automatic sanitization of user input to prevent XSS attacks
- Validation schemas defined in `validations/` directory

### Security Middleware
- Helmet.js for security headers
- Rate limiting (configurable per endpoint)
  - General API: 100 requests per 15 minutes
  - Authentication: 5 attempts per 15 minutes
- CORS protection with environment-configurable origins
- Input sanitization middleware

### Testing
- Comprehensive test suite with Jest
- Multi-tenant isolation tests to ensure data segregation
- Integration tests for API endpoints
- Unit tests for utilities and middleware
- Coverage thresholds enforced (60% minimum)

### Database Migrations
- Version-controlled schema changes with rollback capability
- Performance indexes for multi-tenant queries
- Timestamp standardization across collections

### Environment Configuration
- Secure session management with configurable secrets
- Environment-based configuration for all sensitive values
- Example `.env.example` file provided for setup
