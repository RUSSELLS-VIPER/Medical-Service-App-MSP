const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MSP (Medical Service Provider) API',
            version: '1.0.0',
            description: 'A comprehensive API for managing medical service providers, patients, appointments, and services',
            contact: {
                name: 'MSP API Support',
                email: 'support@msp.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            },
            {
                url: 'https://api.msp.com',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtained from login endpoints'
                },
                sessionAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'connect.sid',
                    description: 'Session cookie for web authentication'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        message: {
                            type: 'string',
                            example: 'Error message'
                        },
                        error: {
                            type: 'string',
                            example: 'Detailed error information'
                        }
                    }
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        message: {
                            type: 'string',
                            example: 'Operation successful'
                        },
                        data: {
                            type: 'object',
                            description: 'Response data'
                        }
                    }
                },
                Patient: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        firstName: {
                            type: 'string',
                            example: 'John'
                        },
                        lastName: {
                            type: 'string',
                            example: 'Doe'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'john.doe@example.com'
                        },
                        phone: {
                            type: 'string',
                            example: '+1234567890'
                        },
                        dateOfBirth: {
                            type: 'string',
                            format: 'date',
                            example: '1990-01-01'
                        },
                        gender: {
                            type: 'string',
                            enum: ['male', 'female', 'other'],
                            example: 'male'
                        },
                        address: {
                            type: 'object',
                            properties: {
                                street: { type: 'string' },
                                city: { type: 'string' },
                                state: { type: 'string' },
                                zipCode: { type: 'string' }
                            }
                        },
                        role: {
                            type: 'string',
                            example: 'patient'
                        },
                        isVerified: {
                            type: 'boolean',
                            example: true
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Provider: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        firstName: {
                            type: 'string',
                            example: 'Dr. Jane'
                        },
                        lastName: {
                            type: 'string',
                            example: 'Smith'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'jane.smith@example.com'
                        },
                        phone: {
                            type: 'string',
                            example: '+1234567890'
                        },
                        professionalTitle: {
                            type: 'string',
                            example: 'MD'
                        },
                        specialization: {
                            type: 'string',
                            example: 'Cardiology'
                        },
                        licenseNumber: {
                            type: 'string',
                            example: 'MD123456'
                        },
                        yearsOfExperience: {
                            type: 'number',
                            example: 10
                        },
                        verificationStatus: {
                            type: 'string',
                            enum: ['pending', 'approved', 'rejected'],
                            example: 'approved'
                        },
                        role: {
                            type: 'string',
                            example: 'provider'
                        },
                        isVerified: {
                            type: 'boolean',
                            example: true
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Admin: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        firstName: {
                            type: 'string',
                            example: 'Admin'
                        },
                        lastName: {
                            type: 'string',
                            example: 'User'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'admin@msp.com'
                        },
                        phone: {
                            type: 'string',
                            example: '+1234567890'
                        },
                        role: {
                            type: 'string',
                            example: 'admin'
                        },
                        isVerified: {
                            type: 'boolean',
                            example: true
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                ServiceCategory: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        name: {
                            type: 'string',
                            example: 'Cardiology'
                        },
                        description: {
                            type: 'string',
                            example: 'Heart and cardiovascular health services'
                        },
                        shortDescription: {
                            type: 'string',
                            example: 'Heart care services'
                        },
                        icon: {
                            type: 'string',
                            example: 'fa-heart'
                        },
                        color: {
                            type: 'string',
                            example: '#dc2626'
                        },
                        displayOrder: {
                            type: 'number',
                            example: 1
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                ServiceOffering: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        provider: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        category: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        name: {
                            type: 'string',
                            example: 'Cardiology Consultation'
                        },
                        description: {
                            type: 'string',
                            example: 'Comprehensive heart health consultation'
                        },
                        shortDescription: {
                            type: 'string',
                            example: 'Heart consultation'
                        },
                        duration: {
                            type: 'number',
                            example: 60
                        },
                        price: {
                            type: 'number',
                            example: 150.00
                        },
                        currency: {
                            type: 'string',
                            example: 'USD'
                        },
                        isVirtual: {
                            type: 'boolean',
                            example: false
                        },
                        location: {
                            type: 'object',
                            properties: {
                                address: {
                                    type: 'string',
                                    example: '123 MG Road, Koramangala'
                                },
                                city: {
                                    type: 'string',
                                    example: 'Bangalore'
                                },
                                state: {
                                    type: 'string',
                                    example: 'Karnataka'
                                },
                                zipCode: {
                                    type: 'string',
                                    example: '560034'
                                },
                                coordinates: {
                                    type: 'object',
                                    properties: {
                                        latitude: {
                                            type: 'number',
                                            example: 12.9716
                                        },
                                        longitude: {
                                            type: 'number',
                                            example: 77.5946
                                        }
                                    }
                                }
                            }
                        },
                        approvalStatus: {
                            type: 'string',
                            enum: ['pending', 'approved', 'rejected'],
                            example: 'approved'
                        },
                        isActive: {
                            type: 'boolean',
                            example: true
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Appointment: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        patient: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        provider: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        service: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        date: {
                            type: 'string',
                            format: 'date',
                            example: '2024-01-15'
                        },
                        startTime: {
                            type: 'string',
                            example: '10:00'
                        },
                        endTime: {
                            type: 'string',
                            example: '11:00'
                        },
                        duration: {
                            type: 'number',
                            example: 60
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'],
                            example: 'pending'
                        },
                        notes: {
                            type: 'string',
                            example: 'Patient notes'
                        },
                        patientNotes: {
                            type: 'string',
                            example: 'Patient provided notes'
                        },
                        providerNotes: {
                            type: 'string',
                            example: 'Provider notes'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Notification: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        recipient: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        recipientModel: {
                            type: 'string',
                            enum: ['Patient', 'Provider', 'Admin'],
                            example: 'Patient'
                        },
                        sender: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        senderModel: {
                            type: 'string',
                            enum: ['Patient', 'Provider', 'Admin'],
                            example: 'Provider'
                        },
                        type: {
                            type: 'string',
                            example: 'appointment_confirmation'
                        },
                        title: {
                            type: 'string',
                            example: 'Appointment Confirmed'
                        },
                        message: {
                            type: 'string',
                            example: 'Your appointment has been confirmed'
                        },
                        isRead: {
                            type: 'boolean',
                            example: false
                        },
                        priority: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                            example: 'high'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                }
            }
        },
        security: [
            {
                bearerAuth: []
            },
            {
                sessionAuth: []
            }
        ]
    },
    apis: [
        './app/routes/*.js',
        './app/docs/*.js',
        './index.js'
    ]
};

const specs = swaggerJsdoc(options);

module.exports = specs;
