// app/config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/msp';
        const dbName = process.env.MONGO_DB_NAME || 'msp';

        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000, // fail fast after 10s
            dbName,
        });

        console.log(`✅ MongoDB Connected`);
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
        process.exit(1); // stop the app if DB fails
    }
};

module.exports = connectDB;
