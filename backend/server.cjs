const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // Store this in .env in production

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploaded images
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// MongoDB Connection
let db;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_dashboard';

async function connectToMongo() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    console.log('Connected to MongoDB');
    db = client.db(process.env.MONGODB_DB || 'admin_dashboard');
    
    // Create collections if they don't exist
    if (!(await db.listCollections({ name: 'users' }).hasNext())) {
      await db.createCollection('users');
      const adminExists = await db.collection('users').findOne({ email: 'admin@example.com' });
      if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await db.collection('users').insertOne({
          name: 'Admin User',
          email: 'admin@example.com',
          password: hashedPassword,
          role: 'admin',
          createdAt: new Date(),
        });
        console.log('Admin user created');
      }
    }
    
    if (!(await db.listCollections({ name: 'products' }).hasNext())) {
      await db.createCollection('products');
    }
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png) are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// API Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date(),
    };

    const result = await db.collection('users').insertOne(newUser);

    const token = jwt.sign(
      { id: result.insertedId.toString(), email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { password: _, ...userWithoutPassword } = newUser;
    userWithoutPassword._id = result.insertedId;

    res.status(201).json({ success: true, user: userWithoutPassword, token });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({ success: true, user: userWithoutPassword, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Products Routes (Protected with JWT)
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    const products = await db.collection('products').find().toArray();
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Server error fetching products' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const product = {
      ...req.body,
      createdAt: new Date(),
    };

    const result = await db.collection('products').insertOne(product);
    res.status(201).json({ ...product, _id: result.insertedId });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Server error creating product' });
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await db.collection('products').findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: 'Server error fetching product' });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.collection('products').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const updatedProduct = await db.collection('products').findOne({
      _id: new ObjectId(req.params.id),
    });

    res.json(updatedProduct);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Server error updating product' });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.collection('products').deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

// Image Upload Route
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.json({ imageUrl });
  } catch (err) {
    console.error('Error uploading image:', err);
    res.status(500).json({ message: 'Server error uploading image' });
  }
});

// Serve React frontend (in production)
app.get(/^\/(?!api).*/, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    res.json({ message: 'API server running in development mode' });
  }
});

// Start server
async function startServer() {
  await connectToMongo();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();