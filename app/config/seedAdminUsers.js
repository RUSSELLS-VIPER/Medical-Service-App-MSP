const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const adminUsers = [
    {
        email: 'admin@msp.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+1234567890',
        role: 'admin',
        isVerified: true,
        isActive: true
    },
    {
        email: 'superadmin@healthcare.com',
        password: 'superadmin2024',
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+1987654321',
        role: 'admin',
        isVerified: true,
        isActive: true
    },
    {
        email: 'support@healthcare.com',
        password: 'support123',
        firstName: 'Support',
        lastName: 'Team',
        phone: '+1555123456',
        role: 'admin',
        isVerified: true,
        isActive: true
    }
];

async function seedAdminUsers() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/msp';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');
        console.log('📊 Database:', mongoose.connection.name);

        // Check if admin users already exist
        const existingAdmins = await Admin.find({});
        if (existingAdmins.length > 0) {
            console.log(`⚠️  Found ${existingAdmins.length} existing admin users`);
            console.log('Existing admin emails:');
            existingAdmins.forEach(admin => {
                console.log(`   - ${admin.email}`);
            });

            const shouldContinue = process.argv.includes('--force');
            if (!shouldContinue) {
                console.log('\n💡 To overwrite existing admin users, run with --force flag');
                console.log('   Example: node app/config/seedAdminUsers.js --force');
                console.log('\n🚀 You can now login with any of these admin accounts!');
                console.log('   Visit: http://localhost:3000/auth/admin/login');
                process.exit(0);
            }

            console.log('\n🔄 Force flag detected, overwriting existing admin users...');
            await Admin.deleteMany({});
            console.log('✅ Cleared existing admin users');
        }

        // Create new admin users
        console.log('\n📝 Creating admin users...');
        const createdAdmins = [];

        for (const adminData of adminUsers) {
            const admin = await Admin.create(adminData);
            createdAdmins.push(admin);
            console.log(`✅ Created admin: ${admin.firstName} ${admin.lastName} (${admin.email})`);
        }

        console.log(`\n🎉 Successfully created ${createdAdmins.length} admin users!`);

        // Display login credentials
        console.log('\n🔑 Admin Login Credentials:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        createdAdmins.forEach(admin => {
            console.log(`\n👤 ${admin.firstName} ${admin.lastName}`);
            console.log(`   📧 Email: ${admin.email}`);
            console.log(`   🔐 Password: ${adminUsers.find(u => u.email === admin.email).password}`);
            console.log(`   📱 Phone: ${admin.phone}`);
            console.log(`   ✅ Verified: ${admin.isVerified}`);
            console.log(`   🟢 Active: ${admin.isActive}`);
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n🚀 You can now login with any of these admin accounts!');
        console.log('   Visit: http://localhost:3000/auth/admin/login');
        console.log('   Or test route: http://localhost:3000/admin/login-test');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding admin users:', error);
        console.error('Error stack:', error.stack);
        process.exit(1);
    }
}

// Run the seeding function
seedAdminUsers();
