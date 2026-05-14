const mongoose = require('mongoose');
const ServiceCategory = require('../models/ServiceCategory');

const serviceCategories = [
    {
        name: 'Ambulance',
        description: 'Emergency medical transportation services',
        shortDescription: 'Emergency medical transport',
        icon: 'fa-ambulance',
        color: '#dc2626',
        isActive: true,
        displayOrder: 1,
        keywords: ['emergency', 'transport', 'ambulance', 'medical'],
        requirements: ['Valid license', 'Emergency equipment', 'Trained personnel'],
        features: ['24/7 availability', 'Emergency response', 'Medical equipment on board']
    },
    {
        name: 'Ayurvedic Massage Centre',
        description: 'Traditional Ayurvedic massage and wellness services',
        shortDescription: 'Ayurvedic massage and holistic wellness',
        icon: 'fa-spa',
        color: '#059669',
        isActive: true,
        displayOrder: 2,
        keywords: ['ayurvedic', 'massage', 'wellness', 'holistic'],
        requirements: ['Ayurvedic certification', 'Hygiene standards', 'Trained therapists'],
        features: ['Traditional techniques', 'Natural oils', 'Wellness consultation']
    },
    {
        name: 'Druggist and Chemist',
        description: 'Pharmaceutical services including medication dispensing',
        shortDescription: 'Pharmacy and medication services',
        icon: 'fa-pills',
        color: '#7c3aed',
        isActive: true,
        displayOrder: 3,
        keywords: ['pharmacy', 'medication', 'drugs', 'prescription'],
        requirements: ['Pharmacy license', 'Valid prescriptions', 'Storage compliance'],
        features: ['Prescription filling', 'Medication consultation', 'Health products']
    },
    {
        name: 'Dental Care',
        description: 'Comprehensive dental health services',
        shortDescription: 'Complete dental health and treatment',
        icon: 'fa-tooth',
        color: '#0891b2',
        isActive: true,
        displayOrder: 4,
        keywords: ['dental', 'teeth', 'oral health', 'dentist'],
        requirements: ['Dental license', 'Sterilization equipment', 'Professional training'],
        features: ['Regular checkups', 'Emergency care', 'Cosmetic procedures']
    },
    {
        name: 'Doctor Chamber',
        description: 'Private medical consultation services',
        shortDescription: 'Medical consultation and treatment',
        icon: 'fa-user-md',
        color: '#2563eb',
        isActive: true,
        displayOrder: 5,
        keywords: ['doctor', 'consultation', 'medical', 'treatment'],
        requirements: ['Medical license', 'Professional certification', 'Insurance'],
        features: ['Private consultation', 'Diagnosis', 'Treatment plans']
    },
    {
        name: 'Eye Care',
        description: 'Comprehensive eye care services',
        shortDescription: 'Complete eye health and vision care',
        icon: 'fa-eye',
        color: '#0ea5e9',
        isActive: true,
        displayOrder: 6,
        keywords: ['eye care', 'vision', 'ophthalmology', 'optometry'],
        requirements: ['Eye care license', 'Specialized equipment', 'Professional training'],
        features: ['Vision testing', 'Eye examinations', 'Glasses/contacts']
    },
    {
        name: 'Gym and Fitness',
        description: 'Physical fitness and wellness services',
        shortDescription: 'Fitness training and wellness programs',
        icon: 'fa-dumbbell',
        color: '#f59e0b',
        isActive: true,
        displayOrder: 7,
        keywords: ['fitness', 'gym', 'exercise', 'wellness'],
        requirements: ['Fitness certification', 'Safety equipment', 'Trained instructors'],
        features: ['Personal training', 'Group classes', 'Equipment access']
    },
    {
        name: 'Hospitals',
        description: 'Comprehensive hospital and medical facility services',
        shortDescription: 'Full-service hospital and medical facilities',
        icon: 'fa-hospital',
        color: '#dc2626',
        isActive: true,
        displayOrder: 8,
        keywords: ['hospital', 'medical facility', 'emergency', 'surgery'],
        requirements: ['Hospital license', 'Medical staff', 'Emergency equipment'],
        features: ['Emergency care', 'Surgery', 'Inpatient care', 'Specialized units']
    },
    {
        name: 'Maternity and Children',
        description: 'Maternal and pediatric healthcare services',
        shortDescription: 'Maternal and child healthcare services',
        icon: 'fa-baby',
        color: '#ec4899',
        isActive: true,
        displayOrder: 9,
        keywords: ['maternity', 'pediatric', 'children', 'pregnancy'],
        requirements: ['Obstetric license', 'Pediatric certification', 'Child-friendly facilities'],
        features: ['Prenatal care', 'Delivery services', 'Pediatric care']
    },
    {
        name: 'Nurse/Aya',
        description: 'Professional nursing and caregiving services',
        shortDescription: 'Professional nursing and care services',
        icon: 'fa-user-nurse',
        color: '#0891b2',
        isActive: true,
        displayOrder: 10,
        keywords: ['nursing', 'caregiving', 'home care', 'medical assistance'],
        requirements: ['Nursing license', 'Background check', 'Professional training'],
        features: ['Home care', 'Medical assistance', 'Patient monitoring']
    },
    {
        name: 'Nursing Home',
        description: 'Long-term care and nursing home services',
        shortDescription: 'Long-term care and assisted living facilities',
        icon: 'fa-home',
        color: '#059669',
        isActive: true,
        displayOrder: 11,
        keywords: ['nursing home', 'long-term care', 'elderly care', 'assisted living'],
        requirements: ['Facility license', 'Medical staff', 'Safety compliance'],
        features: ['24/7 care', 'Medical monitoring', 'Social activities']
    },
    {
        name: 'Radiology',
        description: 'Medical imaging and diagnostic services',
        shortDescription: 'Advanced medical imaging and diagnostics',
        icon: 'fa-x-ray',
        color: '#7c3aed',
        isActive: true,
        displayOrder: 12,
        keywords: ['radiology', 'imaging', 'diagnostic', 'x-ray'],
        requirements: ['Radiology license', 'Imaging equipment', 'Radiation safety'],
        features: ['X-ray imaging', 'CT scans', 'MRI scans', 'Ultrasound']
    },
    {
        name: 'Yoga',
        description: 'Yoga instruction and wellness services',
        shortDescription: 'Yoga and meditation wellness services',
        icon: 'fa-pray',
        color: '#059669',
        isActive: true,
        displayOrder: 13,
        keywords: ['yoga', 'meditation', 'wellness', 'mindfulness'],
        requirements: ['Yoga certification', 'Safe practice space', 'Professional training'],
        features: ['Yoga classes', 'Meditation sessions', 'Wellness workshops']
    }
];

async function seedServiceCategories() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/msp');
        console.log('Connected to MongoDB');

        // Clear existing categories
        await ServiceCategory.deleteMany({});
        console.log('Cleared existing service categories');

        // Insert new categories
        const result = await ServiceCategory.insertMany(serviceCategories);
        console.log(`Successfully seeded ${result.length} service categories`);

        // Display the created categories with their ObjectIds
        console.log('\nCreated service categories:');
        result.forEach(category => {
            console.log(`${category.name}: ${category._id}`);
        });

        console.log('\nSeeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding service categories:', error);
        process.exit(1);
    }
}

// Run the seeding function
seedServiceCategories();
