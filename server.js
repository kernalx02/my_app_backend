const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 
require('dotenv').config();

const app = express();

// --- MIDDLEWARE ---
app.use(express.json()); 

// --- CORS CONFIGURATION ---
app.use(cors({
    origin: ["https://epcoran.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

// --- DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ SUCCESS: Connected to MongoDB Atlas"))
    .catch(err => {
        console.error("❌ DATABASE ERROR:", err.message);
        process.exit(1); 
    });

// --- SCHEMAS ---
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }, 
    role: { type: String, default: 'user' },
    profilePic: { type: String, default: '' }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
    username: String,
    profilePic: String,
    content: String,
    image: String,     
    mediaType: String, 
    ups: { type: Array, default: [] },
    downs: { type: Array, default: [] },
    comments: [
      {
        username: String,
        text: String,
        createdAt: { type: Date, default: Date.now }
      }
    ]
}, { timestamps: true });
const Post = mongoose.model('Post', postSchema);

const blacklistSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true },
    bannedAt: { type: Date, default: Date.now }
});
const Blacklist = mongoose.model('Blacklist', blacklistSchema);

// --- ROUTES ---

// 1. AUTHENTICATION
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const isBanned = await Blacklist.findOne({ email: email.toLowerCase() });
        if (isBanned) return res.status(403).json({ message: "This email is blacklisted." });

        const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
        if (existingUser) return res.status(400).json({ message: "Username or Email already exists." });
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        
        const { password: _, ...userData } = newUser._doc;
        res.status(201).json(userData);
    } catch (err) {
        res.status(500).json({ message: "Error creating account." });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(401).json({ message: "Invalid credentials." });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials." });

        const { password: _, ...userData } = user._doc;
        res.json(userData);
    } catch (err) {
        res.status(500).json({ message: "Server error during login." });
    }
});

// 2. USER MANAGEMENT
app.get('/api/users/count', async (req, res) => {
    try {
        const count = await User.countDocuments();
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/users', async (req, res) => {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.json(users);
});

// --- NEW PROFILE UPDATE ROUTE ---
app.put('/api/users/:id', async (req, res) => {
    try {
        const { username, profilePic } = req.body;
        
        // Ensure username isn't taken by someone else
        const existing = await User.findOne({ username, _id: { $ne: req.params.id } });
        if (existing) return res.status(400).json({ message: "Username taken by another member." });

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id, 
            { username, profilePic }, 
            { new: true }
        ).select('-password');

        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ message: "Server error during update." });
    }
});

app.put('/api/users/:id/role', async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
        res.json(user);
    } catch (err) {
        res.status(400).json({ error: "Failed to update role" });
    }
});

// 3. POSTS (CRUD)
app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
});

app.post('/api/posts', async (req, res) => {
    try {
        const newPost = new Post(req.body);
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(400).json({ error: "Failed to create post" });
    }
});

app.put('/api/posts/:id', async (req, res) => {
    const post = await Post.findByIdAndUpdate(req.params.id, { content: req.body.content }, { new: true });
    res.json(post);
});

app.delete('/api/posts/:id', async (req, res) => {
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

// 4. VOTING & COMMENTS
app.post('/api/posts/:id/vote', async (req, res) => {
    const { username, voteType } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send();

    if (voteType === 'up') {
        post.ups = post.ups.includes(username) ? post.ups.filter(u => u !== username) : [...post.ups, username];
        post.downs = post.downs.filter(u => u !== username);
    } else {
        post.downs = post.downs.includes(username) ? post.downs.filter(u => u !== username) : [...post.downs, username];
        post.ups = post.ups.filter(u => u !== username);
    }
    await post.save();
    res.json(post);
});

app.post('/api/posts/:id/comment', async (req, res) => {
    const post = await Post.findById(req.params.id);
    post.comments.push({ username: req.body.username, text: req.body.text });
    await post.save();
    res.json(post);
});

app.delete('/api/posts/:id/comment/:index', async (req, res) => {
    const post = await Post.findById(req.params.id);
    post.comments.splice(req.params.index, 1);
    await post.save();
    res.json(post);
});

// 5. BLACKLIST
app.get('/api/blacklist', async (req, res) => {
    const list = await Blacklist.find();
    res.json(list);
});

app.post('/api/blacklist', async (req, res) => {
    const { email, userId } = req.body;
    await Blacklist.create({ email: email.toLowerCase() });
    if (userId) await User.findByIdAndDelete(userId);
    res.status(201).json({ message: "Banned" });
});

app.delete('/api/blacklist/:email', async (req, res) => {
    await Blacklist.findOneAndDelete({ email: req.params.email.toLowerCase() });
    res.json({ message: "Unbanned" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server active on port ${PORT}`));