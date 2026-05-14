const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const ServiceOffering = require('../models/ServiceOffering');
const ServiceCategory = require('../models/ServiceCategory');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');

// Get service categories
router.get('/service-categories', async (req, res) => {
    try {
        const categories = await ServiceCategory.find({ isActive: true })
            .sort({ displayOrder: 1, name: 1 })
            .select('name description shortDescription icon color isActive displayOrder');

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Error fetching service categories:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching service categories',
            error: error.message
        });
    }
});

// Get service categories (alternative endpoint for frontend compatibility)
router.get('/services/categories', async (req, res) => {
    try {
        let categories = await ServiceCategory.find({ isActive: true })
            .sort({ displayOrder: 1, name: 1 })
            .select('name description shortDescription icon color isActive displayOrder');

        // If no categories exist, create some basic ones for testing
        if (categories.length === 0) {
            console.log('No service categories found, creating basic ones...');
            const basicCategories = [
                {
                    name: 'Ambulance',
                    description: 'Emergency medical transportation services',
                    shortDescription: 'Emergency medical transport',
                    icon: 'fa-ambulance',
                    color: '#dc2626',
                    isActive: true,
                    displayOrder: 1
                },
                {
                    name: 'Doctor Chamber',
                    description: 'Private medical consultation services',
                    shortDescription: 'Medical consultation and treatment',
                    icon: 'fa-user-md',
                    color: '#2563eb',
                    isActive: true,
                    displayOrder: 2
                },
                {
                    name: 'Dental Care',
                    description: 'Comprehensive dental health services',
                    shortDescription: 'Complete dental health and treatment',
                    icon: 'fa-tooth',
                    color: '#0891b2',
                    isActive: true,
                    displayOrder: 3
                },
                {
                    name: 'Eye Care',
                    description: 'Comprehensive eye care services',
                    shortDescription: 'Complete eye health and vision care',
                    icon: 'fa-eye',
                    color: '#0ea5e9',
                    isActive: true,
                    displayOrder: 4
                },
                {
                    name: 'Hospitals',
                    description: 'Comprehensive hospital and medical facility services',
                    shortDescription: 'Full-service hospital and medical facilities',
                    icon: 'fa-hospital',
                    color: '#dc2626',
                    isActive: true,
                    displayOrder: 5
                }
            ];

            try {
                const createdCategories = await ServiceCategory.insertMany(basicCategories);
                console.log(`Created ${createdCategories.length} basic service categories`);
                categories = createdCategories.map(cat => ({
                    _id: cat._id,
                    name: cat.name,
                    description: cat.description,
                    shortDescription: cat.shortDescription,
                    icon: cat.icon,
                    color: cat.color,
                    isActive: cat.isActive,
                    displayOrder: cat.displayOrder
                }));
            } catch (createError) {
                console.error('Error creating basic categories:', createError);
            }
        }

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Error fetching service categories:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching service categories',
            error: error.message
        });
    }
});

// Get provider's services
router.get('/services', protect, restrictTo('provider'), async (req, res) => {
    try {
        const services = await ServiceOffering.find({ provider: req.user.id })
            .populate('category', 'name description')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: services
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching services',
            error: error.message
        });
    }
});

// Multer setup for CSV uploads
const csvStorage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function (req, file, cb) {
        cb(null, 'services-csv-' + Date.now() + path.extname(file.originalname));
    }
});

function csvFileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
        cb(null, true);
    } else {
        cb(new Error('Only CSV files are allowed'));
    }
}

const uploadCsv = multer({ storage: csvStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: csvFileFilter });

// Upload CSV and create services in bulk
router.post('/provider/services/upload-csv', protect, restrictTo('provider'), uploadCsv.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'CSV file is required' });
        }

        // Multer provides the `path` property for disk storage; prefer that.
        let filePath = req.file.path;
        if (!filePath) {
            // Fallback: construct path relative to project root
            filePath = path.join(process.cwd(), 'public', 'uploads', req.file.filename);
        }

        if (!fs.existsSync(filePath)) {
            console.error('Uploaded file not found at expected path:', filePath);
            return res.status(500).json({ success: false, message: `Uploaded file not found: ${filePath}` });
        }

        const content = fs.readFileSync(filePath, 'utf8');

        // Basic CSV parser: header row maps to fields. Handles quoted commas and double-quote escapes.
        function parseCSVLine(line) {
            const result = [];
            let cur = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') { // escaped quote
                        cur += '"';
                        i++; // skip next
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (ch === ',' && !inQuotes) {
                    result.push(cur);
                    cur = '';
                } else {
                    cur += ch;
                }
            }
            result.push(cur);
            return result.map(s => s.trim().replace(/^"/, '').replace(/"$/, ''));
        }

        const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) {
            // cleanup
            try { fs.unlinkSync(filePath); } catch (e) { }
            return res.status(400).json({ success: false, message: 'CSV must contain a header row and at least one data row' });
        }

        // Normalize headers to canonical keys we expect. This accepts a variety of header formats
        // from exports (e.g., "Service Name", "Duration (minutes)", "Virtual/Online Service").
        const rawHeaders = parseCSVLine(lines[0]);
        const headers = rawHeaders.map(h => {
            const normalized = (h || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            // Map common variants to canonical keys
            if (['servicename', 'name', 'service_name'].includes(normalized)) return 'name';
            if (['servicecategory', 'category', 'service_category'].includes(normalized)) return 'category';
            if (normalized.startsWith('duration')) return 'duration';
            if (['price', 'cost', 'amount'].includes(normalized)) return 'price';
            if (['currency', 'curr'].includes(normalized)) return 'currency';
            if (['description', 'details'].includes(normalized)) return 'description';
            if (['shortdescription', 'shortdesc', 'short_description'].includes(normalized)) return 'shortDescription';
            if (['virtualonlineservice', 'virtual', 'isvirtual', 'isonline', 'virtual_service'].includes(normalized)) return 'isVirtual';
            if (['address', 'locationaddress'].includes(normalized)) return 'address';
            if (['city', 'locationcity'].includes(normalized)) return 'city';
            if (['state', 'locationstate'].includes(normalized)) return 'state';
            if (['pincode', 'zipcode', 'postalcode', 'pin'].includes(normalized)) return 'pincode';
            if (['latitude', 'lat'].includes(normalized)) return 'latitude';
            if (['longitude', 'lon', 'lng'].includes(normalized)) return 'longitude';
            // default: use the cleaned header if nothing matched
            return normalized || h;
        });

        const created = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            const row = parseCSVLine(lines[i]);
            if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                const key = headers[j];
                const val = row[j] !== undefined ? row[j] : '';
                obj[key] = val;
            }

            // Map expected CSV columns to ServiceOffering fields (use canonical keys)
            const name = (obj.name || '').toString().trim();
            let categoryValue = (obj.category || '').toString().trim();
            // duration may include non-digits in header, ensure it's parsed
            const durationRaw = (obj.duration || '').toString().trim();
            const duration = durationRaw ? parseInt(durationRaw.replace(/[^0-9]/g, ''), 10) : null;
            const priceRaw = (obj.price || '').toString().trim();
            const price = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, '')) : 0;
            // Currency might look like "INR (₹)"; keep as-is for currency field
            const currency = (obj.currency || '').toString().trim() || 'USD';
            const description = (obj.description || '').toString().trim();
            const shortDescription = (obj.shortDescription || '').toString().trim();
            const isVirtualRaw = (obj.isVirtual || '').toString().trim().toLowerCase();
            const isVirtual = ['true', '1', 'yes', 'y'].includes(isVirtualRaw);

            // validate
            if (!name || !categoryValue || !duration) {
                errors.push({ row: i + 1, message: 'Missing required field (name, category, or duration)', data: obj });
                continue;
            }

            // Resolve category: try _id first, then name; create if name not found
            let categoryId = null;
            try {
                if (categoryValue && mongoose.Types.ObjectId.isValid(categoryValue)) {
                    const cat = await ServiceCategory.findById(categoryValue);
                    if (cat) categoryId = cat._id;
                }
                if (!categoryId) {
                    // lookup by name (case-insensitive)
                    let cat = await ServiceCategory.findOne({ name: new RegExp('^' + categoryValue + '$', 'i') });
                    if (!cat) {
                        cat = new ServiceCategory({ name: categoryValue, isActive: true });
                        await cat.save();
                    }
                    categoryId = cat._id;
                }
            } catch (catErr) {
                errors.push({ row: i + 1, message: `Category resolution failed: ${catErr.message}`, data: obj });
                continue;
            }

            try {
                const service = new ServiceOffering({
                    provider: req.user._id,
                    name: name,
                    category: categoryId,
                    description,
                    shortDescription,
                    duration,
                    price: isNaN(price) ? 0 : price,
                    currency: currency || 'USD',
                    isVirtual: !!isVirtual,
                    location: {},
                    isActive: true,
                    approvalStatus: 'pending'
                });

                await service.save();
                created.push({ row: i + 1, id: service._id, name: service.name });
            } catch (createErr) {
                errors.push({ row: i + 1, message: `Create failed: ${createErr.message}`, data: obj });
            }
        }

        // cleanup uploaded file
        try { fs.unlinkSync(filePath); } catch (e) { }

        res.json({ success: true, created: created.length, createdRows: created, errors });
    } catch (error) {
        console.error('CSV upload error:', error);
        res.status(500).json({ success: false, message: 'Failed to process CSV', error: error.message });
    }
});

// Service creation endpoint moved to providerRoutes.js to avoid conflicts

// Update service
router.put('/services/:id', protect, restrictTo('provider'), async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Validate MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid service ID format'
            });
        }

        // Check if service exists and belongs to provider
        const service = await ServiceOffering.findOne({
            _id: id,
            provider: req.user.id
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found or unauthorized'
            });
        }

        // Update service
        const updatedService = await ServiceOffering.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            data: updatedService,
            message: 'Service updated successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating service',
            error: error.message
        });
    }
});

// Delete service
router.delete('/services/:id', protect, restrictTo('provider'), async (req, res) => {
    try {
        const { id } = req.params;

        // Validate MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid service ID format'
            });
        }

        const service = await ServiceOffering.findOne({
            _id: id,
            provider: req.user.id
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found or unauthorized'
            });
        }

        // Soft delete - mark as inactive
        await ServiceOffering.findByIdAndUpdate(id, { isActive: false });

        res.json({
            success: true,
            message: 'Service deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting service',
            error: error.message
        });
    }
});

// Toggle service status
router.patch('/services/:id/toggle-status', protect, restrictTo('provider'), async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        // Validate MongoDB ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid service ID format'
            });
        }

        const service = await ServiceOffering.findOneAndUpdate(
            {
                _id: id,
                provider: req.user.id
            },
            { isActive },
            { new: true }
        );

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found or unauthorized'
            });
        }

        res.json({
            success: true,
            data: service,
            message: `Service ${isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating service status',
            error: error.message
        });
    }
});

// Public appointment booking endpoint (no authentication required)
router.post('/appointments/public', async (req, res) => {
    try {
        const {
            service,
            date,
            preferredTime,
            notes,
            phone,
            patientName,
            patientEmail
        } = req.body;

        console.log('🔍 Public appointment booking request:', req.body);

        // Validate required fields
        if (!service || !date || !preferredTime || !patientName || !patientEmail) {
            return res.status(400).json({
                success: false,
                message: 'Service, date, preferred time, patient name, and email are required'
            });
        }

        // Validate date is in the future
        const appointmentDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (appointmentDate < today) {
            return res.status(400).json({
                success: false,
                message: 'Appointment date must be in the future'
            });
        }

        // Get service details with populated provider
        const serviceDetails = await ServiceOffering.findById(service).populate('provider', 'firstName lastName');
        if (!serviceDetails) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Check if service is active and approved
        if (!serviceDetails.isActive || serviceDetails.approvalStatus !== 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Service is not available for booking'
            });
        }

        // Calculate start and end time based on preferred time and duration
        const [hours, minutes] = preferredTime.split(':').map(Number);
        const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        const endTimeMinutes = hours * 60 + minutes + serviceDetails.duration;
        const endHours = Math.floor(endTimeMinutes / 60);
        const endMinutes = endTimeMinutes % 60;
        const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

        // Check for time conflicts
        const conflictingAppointment = await Appointment.findOne({
            provider: serviceDetails.provider,
            date: appointmentDate,
            status: { $in: ['pending', 'confirmed'] },
            $or: [
                {
                    startTime: { $lt: endTime },
                    endTime: { $gt: startTime }
                }
            ]
        });

        if (conflictingAppointment) {
            return res.status(400).json({
                success: false,
                message: 'This time slot is not available. Please choose another time.'
            });
        }

        // Create a temporary patient record or find existing one
        let patient = await Patient.findOne({ email: patientEmail });

        if (!patient) {
            // Create temporary patient record with required fields
            const nameParts = patientName.trim().split(' ');
            const firstName = nameParts[0] || patientName;
            const lastName = nameParts.slice(1).join(' ') || firstName; // Use firstName as fallback

            patient = new Patient({
                firstName: firstName,
                lastName: lastName,
                email: patientEmail,
                phone: phone || '',
                password: 'tempPassword123', // Temporary password for public booking
                dateOfBirth: new Date('1990-01-01'), // Default date of birth
                gender: 'other', // Default gender
                role: 'patient',
                roleName: 'patient',
                isActive: true,
                isVerified: false, // Will need verification later
                address: {
                    street: '',
                    city: '',
                    state: '',
                    zipCode: ''
                }
            });
            await patient.save();
        }

        // Create appointment
        const appointment = new Appointment({
            patient: patient._id,
            provider: serviceDetails.provider,
            service: service,
            serviceCategory: serviceDetails.category,
            date: appointmentDate,
            startTime,
            endTime,
            duration: serviceDetails.duration,
            status: 'pending',
            notes: notes || '',
            patientNotes: notes || '',
            location: {
                address: patient.address || '',
                city: patient.city || '',
                state: patient.state || '',
                zipCode: patient.zipCode || ''
            },
            bookingSource: 'public_services_page'
        });

        await appointment.save();

        // Send confirmation email to patient
        try {
            await sendEmail({
                to: patientEmail,
                subject: 'Appointment Booking Confirmation',
                html: `
                    <h2>Appointment Booking Confirmation</h2>
                    <p>Dear ${patientName},</p>
                    <p>Your appointment has been successfully booked!</p>
                    <h3>Appointment Details:</h3>
                    <ul>
                        <li><strong>Service:</strong> ${serviceDetails.name}</li>
                        <li><strong>Date:</strong> ${appointmentDate.toLocaleDateString()}</li>
                        <li><strong>Time:</strong> ${startTime}</li>
                        <li><strong>Duration:</strong> ${serviceDetails.duration} minutes</li>
                        <li><strong>Provider:</strong> ${serviceDetails.provider.firstName} ${serviceDetails.provider.lastName}</li>
                    </ul>
                    <p>We will contact you soon to confirm your appointment.</p>
                    <p>Thank you for choosing our services!</p>
                `
            });
        } catch (emailError) {
            console.error('❌ Error sending confirmation email:', emailError);
            // Don't fail the booking if email fails
        }

        console.log(`✅ Public appointment booked successfully: ${appointment._id}`);

        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully! Check your email for confirmation.',
            data: {
                appointmentId: appointment._id,
                appointmentDate: appointmentDate,
                startTime: startTime,
                serviceName: serviceDetails.name
            }
        });

    } catch (error) {
        console.error('❌ Error in public appointment booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error booking appointment',
            error: error.message
        });
    }
});

// Book appointment from services page (requires patient authentication)
router.post('/appointments', protect, restrictTo('patient'), async (req, res) => {
    try {
        const {
            service,
            date,
            preferredTime,
            notes,
            phone
        } = req.body;

        // Validate required fields
        if (!service || !date || !preferredTime) {
            return res.status(400).json({
                success: false,
                message: 'Service, date, and preferred time are required'
            });
        }

        // Validate date is in the future
        const appointmentDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (appointmentDate < today) {
            return res.status(400).json({
                success: false,
                message: 'Appointment date must be in the future'
            });
        }

        // Get service details with populated provider
        const serviceDetails = await ServiceOffering.findById(service).populate('provider', 'firstName lastName');
        if (!serviceDetails) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        // Check if service is active and approved
        if (!serviceDetails.isActive || serviceDetails.approvalStatus !== 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Service is not available for booking'
            });
        }

        // Calculate start and end time based on preferred time and duration
        const [hours, minutes] = preferredTime.split(':').map(Number);
        const startTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        const endTimeMinutes = hours * 60 + minutes + serviceDetails.duration;
        const endHours = Math.floor(endTimeMinutes / 60);
        const endMinutes = endTimeMinutes % 60;
        const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

        // Check for time conflicts
        const conflictingAppointment = await Appointment.findOne({
            provider: serviceDetails.provider,
            date: appointmentDate,
            status: { $in: ['pending', 'confirmed'] },
            $or: [
                {
                    startTime: { $lt: endTime },
                    endTime: { $gt: startTime }
                }
            ]
        });

        if (conflictingAppointment) {
            return res.status(400).json({
                success: false,
                message: 'This time slot is not available. Please choose another time.'
            });
        }

        // Create appointment
        const appointment = new Appointment({
            patient: req.user._id,
            provider: serviceDetails.provider,
            service: service,
            serviceCategory: serviceDetails.category,
            date: appointmentDate,
            startTime,
            endTime,
            duration: serviceDetails.duration,
            status: 'pending',
            notes: notes || '',
            patientNotes: notes || '',
            location: {
                address: req.user.address || '',
                city: req.user.city || '',
                state: req.user.state || '',
                zipCode: req.user.zipCode || ''
            }
        });

        await appointment.save();

        // Populate for response
        await appointment.populate([
            { path: 'patient', select: 'firstName lastName email' },
            { path: 'provider', select: 'firstName lastName email' },
            { path: 'service', select: 'name price' },
            { path: 'serviceCategory', select: 'name' }
        ]);

        // Send confirmation email to patient
        try {
            await sendEmail({
                to: req.user.email,
                subject: 'Appointment Booking Confirmation',
                text: `Hello ${req.user.firstName},\n\nYour appointment has been booked successfully!\n\nService: ${serviceDetails.name}\nProvider: Dr. ${appointment.provider.firstName} ${appointment.provider.lastName}\nDate: ${appointmentDate.toLocaleDateString()}\nTime: ${startTime} - ${endTime}\n\nWe will send you a confirmation once the provider approves your appointment.\n\nThank you for choosing our service!`
            });
        } catch (emailError) {
            console.error('Error sending confirmation email:', emailError);
        }

        // Send notification to provider
        try {
            await Notification.create({
                recipient: serviceDetails.provider,
                recipientModel: 'Provider',
                sender: req.user._id,
                senderModel: 'Patient',
                type: 'new-appointment',
                title: 'New Appointment Request',
                message: `New appointment request from ${req.user.firstName} ${req.user.lastName} for ${serviceDetails.name} on ${appointmentDate.toLocaleDateString()}`,
                relatedEntity: appointment._id,
                relatedEntityModel: 'Appointment'
            });
        } catch (notificationError) {
            console.error('Error creating notification:', notificationError);
        }

        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully',
            data: appointment
        });

    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to book appointment',
            error: error.message
        });
    }
});

// Get public services for the services page
router.get('/services/public', async (req, res) => {
    try {
        const { category, search, page = 1, limit = 12 } = req.query;

        // Build query for active and approved services
        const query = {
            isActive: true,
            approvalStatus: 'approved'
        };

        // Add category filter if provided
        if (category && category !== 'all') {
            query.category = category;
        }

        // Add search filter if provided
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { shortDescription: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Fetch services with populated provider and category
        const services = await ServiceOffering.find(query)
            .populate('provider', 'firstName lastName professionalTitle specialization')
            .populate('category', 'name description icon color')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const totalServices = await ServiceOffering.countDocuments(query);
        const totalPages = Math.ceil(totalServices / limit);

        res.json({
            success: true,
            data: services,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalServices,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Error fetching public services:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching services',
            error: error.message
        });
    }
});

// Patient appointment status update
router.patch('/patient/appointments/:appointmentId/status', protect, restrictTo('patient'), async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { status, cancellationReason } = req.body;
        const patientId = req.user._id;

        // Validate appointment exists and belongs to patient
        const appointment = await Appointment.findById(appointmentId)
            .populate('service', 'name')
            .populate('provider', 'firstName lastName email');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }

        if (appointment.patient.toString() !== patientId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only update your own appointments'
            });
        }

        // Validate status transition
        const allowedTransitions = {
            'pending': ['confirmed', 'cancelled', 'rescheduled'],
            'confirmed': ['cancelled', 'rescheduled'],
            'in_progress': ['completed', 'cancelled'],
            'completed': [],
            'cancelled': [],
            'rescheduled': ['confirmed', 'cancelled'],
            'no_show': []
        };

        const currentStatus = appointment.status;
        if (!allowedTransitions[currentStatus] || !allowedTransitions[currentStatus].includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot change status from ${currentStatus} to ${status}`
            });
        }

        // Update appointment
        const updateData = { status };

        if (status === 'cancelled' && cancellationReason) {
            updateData.cancellationReason = cancellationReason;
            updateData.cancelledBy = patientId;
            updateData.cancelledByModel = 'Patient';
            updateData.cancellationDate = new Date();
        }

        const updatedAppointment = await Appointment.findByIdAndUpdate(
            appointmentId,
            updateData,
            { new: true, runValidators: true }
        );

        // Send notification to provider
        if (appointment.provider) {
            await Notification.create({
                recipient: appointment.provider._id,
                recipientModel: 'Provider',
                type: 'appointment_status_change',
                title: 'Appointment Status Updated',
                message: `Patient ${req.user.firstName} ${req.user.lastName} has updated appointment status to ${status}`,
                relatedAppointment: appointmentId,
                isRead: false
            });

            // Send email to provider
            try {
                await sendEmail({
                    to: appointment.provider.email,
                    subject: 'Appointment Status Updated',
                    message: `Patient ${req.user.firstName} ${req.user.lastName} has updated their appointment status to ${status}. Appointment details: ${appointment.service ? appointment.service.name : 'Appointment'} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}. ${cancellationReason ? `Cancellation reason: ${cancellationReason}` : ''}`
                });
            } catch (emailError) {
                console.error('Error sending email to provider:', emailError);
            }
        }

        res.json({
            success: true,
            message: 'Appointment status updated successfully',
            data: updatedAppointment
        });

    } catch (error) {
        console.error('Error updating appointment status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating appointment status',
            error: error.message
        });
    }
});

// ========== ADMIN PATIENTS API ENDPOINTS ==========

// Get all patients (Admin only)
router.get('/admin/patients', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 50, status, search } = req.query;
        const skip = (page - 1) * limit;

        // Build filter
        let filter = {};
        if (status) {
            filter.status = status;
        }
        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const patients = await Patient.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Patient.countDocuments(filter);

        res.json({
            success: true,
            data: patients,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total: total
            }
        });
    } catch (error) {
        console.error('Error fetching patients:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching patients',
            error: error.message
        });
    }
});

// Get single patient (Admin only)
router.get('/admin/patients/:id', protect, restrictTo('admin'), async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id).select('-password');

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        res.json({
            success: true,
            data: patient
        });
    } catch (error) {
        console.error('Error fetching patient:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching patient',
            error: error.message
        });
    }
});

// Toggle patient status (Admin only)
router.patch('/admin/patients/:id/toggle-status', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { status } = req.body;

        if (!status || !['active', 'inactive', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be active, inactive, or pending'
            });
        }

        const patient = await Patient.findByIdAndUpdate(
            req.params.id,
            { status: status },
            { new: true, runValidators: true }
        ).select('-password');

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        res.json({
            success: true,
            message: `Patient status updated to ${status}`,
            data: patient
        });
    } catch (error) {
        console.error('Error updating patient status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating patient status',
            error: error.message
        });
    }
});

// Update patient (Admin only)
router.put('/admin/patients/:id', protect, restrictTo('admin'), async (req, res) => {
    try {
        const allowedUpdates = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'healthInfo', 'status'];
        const updates = {};

        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        const patient = await Patient.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        res.json({
            success: true,
            message: 'Patient updated successfully',
            data: patient
        });
    } catch (error) {
        console.error('Error updating patient:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating patient',
            error: error.message
        });
    }
});

// Delete patient (Admin only)
router.delete('/admin/patients/:id', protect, restrictTo('admin'), async (req, res) => {
    try {
        const patient = await Patient.findByIdAndDelete(req.params.id);

        if (!patient) {
            return res.status(404).json({
                success: false,
                message: 'Patient not found'
            });
        }

        res.json({
            success: true,
            message: 'Patient deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting patient:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting patient',
            error: error.message
        });
    }
});

// ========== ADMIN SERVICE CATEGORIES API ENDPOINTS ==========

// Get all service categories (Admin only)
router.get('/admin/service-categories', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 50, status, search } = req.query;
        const skip = (page - 1) * limit;

        // Build filter
        let filter = {};
        if (status) {
            filter.isActive = status === 'active';
        }
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { shortDescription: { $regex: search, $options: 'i' } }
            ];
        }

        const categories = await ServiceCategory.find(filter)
            .sort({ displayOrder: 1, name: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await ServiceCategory.countDocuments(filter);

        res.json({
            success: true,
            data: categories,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total: total
            }
        });
    } catch (error) {
        console.error('Error fetching service categories:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching service categories',
            error: error.message
        });
    }
});

// Get single service category (Admin only)
router.get('/admin/service-categories/:id', protect, restrictTo('admin'), async (req, res) => {
    try {
        const category = await ServiceCategory.findById(req.params.id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Service category not found'
            });
        }

        res.json({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Error fetching service category:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching service category',
            error: error.message
        });
    }
});

// Create new service category (Admin only)
router.post('/admin/service-categories', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { name, description, shortDescription, icon, color, displayOrder, isActive } = req.body;

        // Validate required fields
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Category name is required'
            });
        }

        // Check if category with same name already exists
        const existingCategory = await ServiceCategory.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: 'A category with this name already exists'
            });
        }

        const category = new ServiceCategory({
            name,
            description,
            shortDescription,
            icon,
            color,
            displayOrder: displayOrder || 0,
            isActive: isActive !== undefined ? isActive : true
        });

        await category.save();

        res.status(201).json({
            success: true,
            message: 'Service category created successfully',
            data: category
        });
    } catch (error) {
        console.error('Error creating service category:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating service category',
            error: error.message
        });
    }
});

// Update service category (Admin only)
router.put('/admin/service-categories/:id', protect, restrictTo('admin'), async (req, res) => {
    try {
        const allowedUpdates = ['name', 'description', 'shortDescription', 'icon', 'color', 'displayOrder', 'isActive'];
        const updates = {};

        Object.keys(req.body).forEach(key => {
            if (allowedUpdates.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        // Check if name is being updated and if it conflicts with existing category
        if (updates.name) {
            const existingCategory = await ServiceCategory.findOne({
                name: { $regex: new RegExp(`^${updates.name}$`, 'i') },
                _id: { $ne: req.params.id }
            });
            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: 'A category with this name already exists'
                });
            }
        }

        const category = await ServiceCategory.findByIdAndUpdate(
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Service category not found'
            });
        }

        res.json({
            success: true,
            message: 'Service category updated successfully',
            data: category
        });
    } catch (error) {
        console.error('Error updating service category:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating service category',
            error: error.message
        });
    }
});

// Toggle service category status (Admin only)
router.patch('/admin/service-categories/:id/toggle-status', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'isActive must be a boolean value'
            });
        }

        const category = await ServiceCategory.findByIdAndUpdate(
            req.params.id,
            { isActive: isActive },
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Service category not found'
            });
        }

        res.json({
            success: true,
            message: `Service category ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: category
        });
    } catch (error) {
        console.error('Error updating service category status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating service category status',
            error: error.message
        });
    }
});

// Delete service category (Admin only)
router.delete('/admin/service-categories/:id', protect, restrictTo('admin'), async (req, res) => {
    try {
        // Check if category is being used by any service offerings
        const serviceOfferings = await ServiceOffering.find({ category: req.params.id });
        if (serviceOfferings.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category. It is being used by ${serviceOfferings.length} service offering(s). Please remove or reassign these services first.`
            });
        }

        const category = await ServiceCategory.findByIdAndDelete(req.params.id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Service category not found'
            });
        }

        res.json({
            success: true,
            message: 'Service category deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting service category:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting service category',
            error: error.message
        });
    }
});

// ========== ADMIN SERVICES API ENDPOINTS ==========

// Get all services with statistics (Admin only)
router.get('/admin/services', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;

        // Build filter
        let filter = { isActive: true };
        if (status) {
            filter.approvalStatus = status;
        }

        const services = await ServiceOffering.aggregate([
            {
                $match: filter
            },
            {
                $lookup: {
                    from: 'providers',
                    localField: 'provider',
                    foreignField: '_id',
                    as: 'provider'
                }
            },
            {
                $unwind: '$provider'
            },
            {
                $lookup: {
                    from: 'servicecategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: {
                    path: '$category',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        professionalTitle: 1
                    },
                    category: {
                        name: 1,
                        description: 1
                    },
                    name: 1,
                    description: 1,
                    basePrice: 1,
                    duration: 1,
                    isActive: 1,
                    approvalStatus: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: parseInt(limit)
            }
        ]);

        // Get statistics
        const stats = await ServiceOffering.aggregate([
            {
                $match: { isActive: true }
            },
            {
                $group: {
                    _id: '$approvalStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        const total = await ServiceOffering.countDocuments({ isActive: true });
        const statsObj = {
            total: total,
            pending: 0,
            approved: 0,
            rejected: 0
        };

        stats.forEach(stat => {
            statsObj[stat._id] = stat.count;
        });

        res.json({
            success: true,
            data: services,
            stats: statsObj,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total: total
            }
        });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching services',
            error: error.message
        });
    }
});

// Get pending services (Admin only)
router.get('/admin/services/pending', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;

        const services = await ServiceOffering.aggregate([
            {
                $match: {
                    approvalStatus: 'pending',
                    isActive: true
                }
            },
            {
                $lookup: {
                    from: 'providers',
                    localField: 'provider',
                    foreignField: '_id',
                    as: 'provider'
                }
            },
            {
                $unwind: '$provider'
            },
            {
                $lookup: {
                    from: 'servicecategories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: {
                    path: '$category',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    provider: {
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        professionalTitle: 1
                    },
                    category: {
                        name: 1,
                        description: 1
                    },
                    name: 1,
                    description: 1,
                    basePrice: 1,
                    duration: 1,
                    isActive: 1,
                    approvalStatus: 1,
                    createdAt: 1,
                    updatedAt: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: parseInt(limit)
            }
        ]);

        // Get statistics
        const stats = await ServiceOffering.aggregate([
            {
                $match: { isActive: true }
            },
            {
                $group: {
                    _id: '$approvalStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        const total = await ServiceOffering.countDocuments({ isActive: true });
        const statsObj = {
            total: total,
            pending: 0,
            approved: 0,
            rejected: 0
        };

        stats.forEach(stat => {
            statsObj[stat._id] = stat.count;
        });

        res.json({
            success: true,
            data: services,
            stats: statsObj,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(services.length / limit),
                total: services.length
            }
        });
    } catch (error) {
        console.error('Error fetching pending services:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending services',
            error: error.message
        });
    }
});

// Update service approval status (Admin only)
router.patch('/admin/services/:id/approve', protect, restrictTo('admin'), async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;

        if (!status || !['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be either "approved" or "rejected"'
            });
        }

        if (status === 'rejected' && !rejectionReason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required when rejecting a service'
            });
        }

        const updateData = {
            approvalStatus: status,
            approvedAt: new Date()
        };

        if (status === 'rejected') {
            updateData.rejectionReason = rejectionReason;
        }

        const service = await ServiceOffering.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('provider', 'firstName lastName email professionalTitle')
            .populate('category', 'name description');

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        res.json({
            success: true,
            message: `Service ${status} successfully`,
            data: service
        });
    } catch (error) {
        console.error('Error updating service status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating service status',
            error: error.message
        });
    }
});

// Get single service (Admin only)
router.get('/admin/services/:id', protect, restrictTo('admin'), async (req, res) => {
    try {
        const service = await ServiceOffering.findById(req.params.id)
            .populate('provider', 'firstName lastName email professionalTitle')
            .populate('category', 'name description');

        if (!service) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        res.json({
            success: true,
            data: service
        });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching service',
            error: error.message
        });
    }
});

module.exports = router;
