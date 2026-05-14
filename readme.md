# Medical Service Booking Platform

A comprehensive web-based medical service booking platform that connects patients with healthcare providers, enabling seamless online booking for 13 healthcare services including doctors, ambulances, yoga, and more.

## 🏥 Project Overview

The Medical Service Booking Platform is a full-featured healthcare marketplace that provides:

- **Patient Services**: Easy appointment booking, service discovery, and health management
- **Provider Tools**: Comprehensive dashboard, appointment management, and analytics
- **Admin Oversight**: Provider verification, system monitoring, and compliance management
- **Security & Compliance**: HIPAA-compliant data handling with end-to-end encryption

## ✨ Key Features

### 🧑‍⚕️ Patient Features
- **Registration & Authentication**: Secure JWT-based authentication with email verification
- **Service Discovery**: Advanced search with filters for category, location, and availability
- **Appointment Management**: Book, reschedule, and cancel appointments with real-time availability
- **Health Dashboard**: Personal health information management and appointment history

- **Reviews & Ratings**: Rate and review healthcare providers

### 🏥 Provider Features
- **Onboarding & Verification**: Multi-step verification process with document upload
- **Service Management**: Create and manage service offerings with pricing and availability
- **Appointment Dashboard**: Accept/reject appointments with calendar-based scheduling
- **Analytics & Reporting**: Performance metrics, revenue tracking, and patient insights
- **Profile Management**: Professional profile with specializations and credentials

### 👨‍💼 Admin Features
- **Provider Verification**: Document review and approval/rejection workflow
- **System Administration**: User management, platform configuration, and monitoring
- **Analytics Dashboard**: Business intelligence and regulatory compliance reporting
- **Content Moderation**: Review management and quality assurance

## 🛠 Technology Stack

### Frontend
- **Framework**: EJS templates with Bootstrap 5.x
- **Styling**: Responsive, mobile-first design
- **JavaScript**: Vanilla JavaScript for client-side interactions
- **Browser Support**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### Backend
- **Runtime**: Node.js with Express.js
- **Architecture**: RESTful API with MVC pattern
- **Middleware**: Custom authentication, logging, and error handling
- **File Handling**: Multer for document upload and processing

### Database & Storage
- **Database**: MongoDB (Atlas) with Mongoose ODM
- **File Storage**: Cloud-based storage for documents and media
- **Backup**: Automated database backups and disaster recovery

### Security & Authentication
- **Authentication**: Passport.js with JWT tokens
- **Authorization**: Role-based access control (RBAC)
- **Data Encryption**: AES-256 for data at rest, TLS 1.3 for data in transit
- **Session Management**: Secure session handling with HTTP-only cookies

### Communication
- **Email**: Nodemailer with SMTP integration
- **Notifications**: Multi-channel delivery (email, SMS, push, in-app)
- **Templates**: Dynamic email templates for various notifications

## 📋 Prerequisites

- Node.js 16.x or higher
- MongoDB 5.0 or higher
- SMTP email service (Gmail, SendGrid, etc.)
- Modern web browser

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd medical-service-platform
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/medical_platform
# or for MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/medical_platform

# Server Configuration
PORT=3000
NODE_ENV=development

# Security
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-session-secret-key-here

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@medicalplatform.com

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./public/uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX_REQUESTS=5
```

### 4. Database Setup
```bash
# Start MongoDB (if running locally)
mongod

# Seed initial data (optional)
npm run seed:categories
```

### 5. Start the Application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 6. Access the Application
- **Main Application**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Documentation**: http://localhost:3000/api-docs

## 📚 API Documentation

### Authentication Endpoints

#### Patient Authentication
```http
POST /api/v1/auth/patient/register
POST /api/v1/auth/patient/login
POST /api/v1/auth/patient/logout
POST /api/v1/auth/patient/verify-email
POST /api/v1/auth/patient/forgot-password
POST /api/v1/auth/patient/reset-password
```

#### Provider Authentication
```http
POST /api/v1/auth/provider/register
POST /api/v1/auth/provider/login
POST /api/v1/auth/provider/logout
POST /api/v1/auth/provider/verify-email
```

#### Admin Authentication
```http
POST /api/v1/auth/admin/login
POST /api/v1/auth/admin/logout
```

### Patient Endpoints

#### Profile Management
```http
GET /api/v1/patients/profile
PUT /api/v1/patients/profile
PUT /api/v1/patients/password
```

#### Appointment Management
```http
GET /api/v1/patients/appointments
POST /api/v1/patients/appointments
GET /api/v1/patients/appointments/:id
PUT /api/v1/patients/appointments/:id
DELETE /api/v1/patients/appointments/:id
```

#### Service Discovery
```http
GET /api/v1/patients/services
GET /api/v1/patients/services/:id
GET /api/v1/patients/providers
GET /api/v1/patients/providers/:id
```

#### Reviews & Ratings
```http
GET /api/v1/patients/reviews
POST /api/v1/patients/reviews
PUT /api/v1/patients/reviews/:id
DELETE /api/v1/patients/reviews/:id
```

### Provider Endpoints

#### Profile Management
```http
GET /api/v1/providers/profile
PUT /api/v1/providers/profile
PUT /api/v1/providers/password
```

#### Service Management
```http
GET /api/v1/providers/services
POST /api/v1/providers/services
PUT /api/v1/providers/services/:id
DELETE /api/v1/providers/services/:id
```

#### Appointment Management
```http
GET /api/v1/providers/appointments
PUT /api/v1/providers/appointments/:id/status
GET /api/v1/providers/appointments/:id
```

#### Analytics
```http
GET /api/v1/providers/analytics
GET /api/v1/providers/analytics/revenue
GET /api/v1/providers/analytics/appointments
```

### Admin Endpoints

#### Provider Management
```http
GET /api/v1/admin/providers
GET /api/v1/admin/providers/:id
PUT /api/v1/admin/providers/:id/verify
PUT /api/v1/admin/providers/:id/status
```

#### System Analytics
```http
GET /api/v1/admin/analytics/overview
GET /api/v1/admin/analytics/revenue
GET /api/v1/admin/analytics/appointments
GET /api/v1/admin/analytics/providers
```

#### User Management
```http
GET /api/v1/admin/patients
GET /api/v1/admin/patients/:id
PUT /api/v1/admin/patients/:id/status
```

## 🏗 Database Schema

### Core Entities

#### Patient
- Personal information (name, email, phone, address)
- Health information (blood type, allergies, conditions)
- Account status and verification
- Audit trail

#### Provider
- Professional information (title, specialization, license)
- Verification status and documents
- Service offerings and availability
- Performance metrics

#### Appointment
- Patient and provider references
- Service and scheduling details

- Status tracking and history

#### ServiceOffering
- Provider and category references
- Pricing and availability settings
- Approval status and analytics
- Location and virtual service support

### Supporting Entities

#### Notification
- Multi-channel delivery support
- Delivery status tracking
- Action requirements and metadata


- Transaction details and status
- Fee breakdown and refunds
- Audit trail and compliance

#### Review
- Rating system with detailed metrics
- Moderation and reporting
- Provider responses

#### BookingHistory
- Complete audit trail
- Status change tracking
- Compliance and dispute resolution

## 🔒 Security Features

### Data Protection
- **Encryption**: AES-256 for sensitive data
- **Transport Security**: TLS 1.3 for data in transit
- **Password Security**: bcrypt with salt rounds
- **Session Security**: HTTP-only cookies with secure flags

### Access Control
- **Role-Based Access**: Patient, Provider, Admin roles
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive input sanitization

### Compliance
- **HIPAA Compliance**: Healthcare data protection
- **Audit Logging**: Complete activity tracking
- **Data Retention**: Configurable retention policies
- **Privacy Controls**: User consent management

## 📊 Analytics & Reporting

### Platform Analytics
- User registration and engagement metrics
- Service category performance
- Revenue and transaction analytics
- System performance monitoring

### Provider Analytics
- Appointment and revenue tracking
- Patient satisfaction metrics
- Service performance analysis
- Business intelligence dashboards

### Admin Reporting
- Regulatory compliance reports
- System health monitoring
- User activity analytics
- Financial reporting

## 🔔 Notification System

### Multi-Channel Delivery
- **Email Notifications**: Booking confirmations, reminders, updates
- **SMS Notifications**: Appointment reminders and alerts
- **Push Notifications**: Real-time updates and alerts
- **In-App Notifications**: System messages and updates

### Notification Types
- Appointment confirmations and reminders

- Provider verification status
- System alerts and maintenance notices
- Review requests and responses

## 🧪 Testing

### Unit Testing
```bash
npm run test:unit
```

### Integration Testing
```bash
npm run test:integration
```

### End-to-End Testing
```bash
npm run test:e2e
```

### Security Testing
```bash
npm run test:security
```

## 🚀 Deployment

### Production Environment
```bash
# Set environment variables
NODE_ENV=production
PORT=3000

# Install production dependencies
npm ci --only=production

# Start the application
npm start
```

### Docker Deployment
```bash
# Build the Docker image
docker build -t medical-service-platform .

# Run the container
docker run -p 3000:3000 medical-service-platform
```

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/medical_platform
JWT_SECRET=your-production-jwt-secret
SESSION_SECRET=your-production-session-secret
EMAIL_HOST=your-smtp-host
EMAIL_PORT=587
EMAIL_USER=your-email
EMAIL_PASS=your-password
ALLOWED_ORIGINS=https://yourdomain.com
```

## 📈 Performance Optimization

### Database Optimization
- Indexed queries for fast retrieval
- Connection pooling for scalability
- Query optimization and caching
- Database monitoring and alerts

### Application Performance
- Response time optimization
- Memory usage monitoring
- Load balancing support
- CDN integration for static assets

### Security Performance
- Rate limiting and DDoS protection
- Input validation and sanitization
- Secure headers and CSP
- Regular security audits

## 🔧 Configuration

### Service Categories
The platform supports 13 healthcare service categories:
1. Doctors
2. Ambulance Services
3. Yoga Classes
4. Dental Care
5. Eye Care
6. Ayurvedic Services
7. Gym & Fitness
8. Hospital Services
9. Maternity Care
10. Nursing Homes
11. Nursing Services
12. Radiology Services
13. Pharmacy/Druggist

### Customization
- Service category management
- Provider verification workflows
- Email template customization
- UI/UX customization

## 🚨 Troubleshooting

### Common Issues

#### Provider Registration Error: Cast to ObjectId failed
**Error**: `CastError: Cast to ObjectId failed for value "doctor-001" (type string) at path "_id" for model "ServiceCategory"`

**Cause**: This error occurs when the system tries to use string IDs (like "doctor-001") instead of valid MongoDB ObjectIds for service categories.

**Solution**:
1. **Seed the database with proper service categories**:
   ```bash
   npm run seed:categories
   ```

2. **Verify database connection**:
   ```bash
   npm run db:check
   ```

3. **Check environment variables**:
   Ensure your `.env` file has the correct `MONGODB_URI` setting.

4. **Restart the application**:
   ```bash
   npm run dev
   ```

#### Database Connection Issues
**Error**: `MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`

**Solution**:
1. Ensure MongoDB is running locally or update `MONGODB_URI` in `.env`
2. For MongoDB Atlas, verify connection string and network access
3. Check firewall settings and MongoDB service status

#### Email Service Issues
**Error**: `Email sending failed during provider registration`

**Solution**:
1. Verify SMTP settings in `.env`
2. Check email service credentials
3. Ensure network connectivity to SMTP server

### Debug Mode
Enable debug logging by setting:
```bash
DEBUG=* npm run dev
```

### Logs
Check application logs for detailed error information:
- Console output during development
- Log files in production
- MongoDB query logs

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Submit a pull request

### Code Standards
- Follow ESLint configuration
- Write comprehensive tests
- Update documentation
- Follow commit message conventions

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](docs/api.md)
- [Database Schema](docs/database.md)
- [Deployment Guide](deployment-guide.md)
- [Security Guide](docs/security.md)

### Contact
- **Email**: support@medicalplatform.com
- **Documentation**: [docs.medicalplatform.com](https://docs.medicalplatform.com)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)

## 🔄 Changelog

### Version 2.0.0 (Current)
- Enhanced security with comprehensive encryption
- Advanced analytics and reporting system
- Multi-channel notification system
- Improved provider verification workflow

- Review and rating system
- Audit trail and compliance features

### Version 1.0.0
- Basic patient and provider registration
- Simple appointment booking system
- Basic admin dashboard
- Email notifications

## 🏆 Acknowledgments

- Healthcare compliance experts for guidance
- Security consultants for audit and recommendations
- Beta testers for feedback and improvements
- Open source community for tools and libraries

## 📝 Complete Source Code Documentation

For comprehensive documentation of the entire Medical Service Booking Platform, refer to:

### ⭐ **[FULL_DOCUMENTATION.md](FULL_DOCUMENTATION.md)** - PRIMARY REFERENCE - Complete Source Code

This single consolidated document contains the entire project documentation:

**Configuration & Infrastructure:**
- Main Application Entry Point (index.js with all middleware)
- Database Configuration and Connection Management
- Passport.js Authentication Strategy Implementation
- Swagger/OpenAPI Specification
- Environment Variable Configuration
- Seed Data (Service Categories & Admin Users)

**Database Models (Complete Schema Definitions):**
- Patient Model (health info, address, verification)
- Provider Model (credentials, verification, documents)
- Admin Model (authentication, audit trail)
- Appointment Model (scheduling, cancellation tracking)
- ServiceOffering Model (pricing models, availability)
- ServiceCategory Model (hierarchical categories, custom fields)
- Review Model (ratings, moderation, provider responses)
- Additional Models (Notification, ProviderVerification, BookingHistory, ProviderAnalytics, Role, DoctorService)

**Application Layer:**
- All Controllers (Patient, Provider, Admin, Service) - Complete implementations
- All Routes (Auth, Patient, Provider, Admin, Service, API) - All endpoint definitions
- All Middleware (Authentication, Error Handling, Role-Based Access, Validation)
- All Services (Notification, Analytics)
- All Utilities (Email Service, Error Classes, Async Handler, Location Utils)

**Deployment & Operations:**
- Docker & Docker Compose Configuration
- MongoDB Database Indexes
- Security Checklist
- Performance Optimization Guidelines
- Production Deployment Guide with PM2
- Troubleshooting Guide
- API Testing Routes

**Complete Feature Implementations:**
- RESTful API endpoints with proper error handling
- JWT and session-based authentication
- Role-based access control (RBAC) for 3 user types
- Security middleware (Helmet, CORS, input sanitization)
- Multi-channel notification system (email, SMS, push, in-app)
- Advanced appointment booking with conflict detection
- Complex provider verification workflow
- Service management with flexible pricing models (fixed, hourly, tiered, dynamic, subscription)
- Comprehensive analytics and reporting
- Review and rating system with moderation

### Alternative References (Individual Parts - Use FULL_DOCUMENTATION.md instead):
- [SOURCE_CODE_REFERENCE.md](SOURCE_CODE_REFERENCE.md) - Foundation & Core (deprecated)
- [ADVANCED_SOURCE_CODE.md](ADVANCED_SOURCE_CODE.md) - Controllers & Routes (deprecated)
- [COMPLETE_SOURCE_CODE.md](COMPLETE_SOURCE_CODE.md) - Admin & Advanced (deprecated)
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Operations (deprecated)