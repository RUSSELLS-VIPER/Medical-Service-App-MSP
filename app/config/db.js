// app/config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/msp';
        const dbName = process.env.MONGO_DB_NAME || 'msp';

        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 10000,
            dbName,
        });

        console.log('MongoDB Connected');
        return true;
    } catch (error) {
        console.error('MongoDB Connection Error:', error.message);
        return false;
    }
};

module.exports = connectDB;
