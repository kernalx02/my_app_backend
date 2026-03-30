const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- MIDDLEWARE ---
app.use(express.json()); 

// --- CORS CONFIGURATION ---
// Allows your Netlify frontend to communicate with this Render backend
app.use(cors({
    origin: ["https://epcoran.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

// --- DATABASE CONNECTION ---
const connectDB = async () => {
    try {
        console.log("⏳ Attempting to bridge to MongoDB Atlas...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ SUCCESS: Connected to MongoDB Atlas");
    } catch (err) {
        console.error("❌ DATABASE ERROR:", err.message);
        process.exit(1); 
    }
};
connectDB();

// --- SCHEMAS ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }, // Tip: Use bcrypt for hashing in the future
    role: { type: String, default: 'user' },
    profilePic: { type: String, default: '' },
    posts: { type: Array, default: [] }
});
const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
    username: String,
    profilePic: String,
    content: String,
    image: String,     
    mediaType: String, 
    ups: { type: Array, default: [] },
    downs: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// --- ROUTES ---

// Root Health Check
app.get('/', (req, res) => res.send("The Expose Backend is running!"));

// 1. SIGNUP ROUTE
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
        
        if (existingUser) {
            return res.status(400).json({ message: "Username or Email already exists." });
        }

        const newUser = new User({ username, email, password });
        await newUser.save();
        
        const { password: _, ...userData } = newUser._doc;
        res.status(201).json(userData);
    } catch (err) {
        res.status(500).json({ message: "Error creating account." });
    }
});

// 2. LOGIN ROUTE
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user || user.password !== password) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        const { password: _, ...userData } = user._doc;
        res.json(userData);
    } catch (err) {
        res.status(500).json({ message: "Server error during login." });
    }
});

// 3. POSTS ROUTES
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch posts" });
    }
});

app.post('/api/posts', async (req, res) => {
    try {
        const newPost = new Post(req.body);
        const savedPost = await newPost.save();
        res.status(201).json(savedPost);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- START SERVER ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));