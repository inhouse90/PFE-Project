const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');

require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_NAME = process.env.SHOPIFY_STORE_NAME || 'jaaagd-tz';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Nodemailer for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

// MongoDB Connection
let db;
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_dashboard';

async function connectToMongo() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('Connected to MongoDB at', new Date().toISOString());
    db = client.db(process.env.MONGODB_DB || 'admin_dashboard');

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
        console.log('Admin user created at', new Date().toISOString());
      }
    }

    if (!(await db.listCollections({ name: 'products' }).hasNext())) {
      await db.createCollection('products');
      console.log('Products collection created at', new Date().toISOString());
    }

    if (!(await db.listCollections({ name: 'orders' }).hasNext())) {
      await db.createCollection('orders');
      console.log('Orders collection created at', new Date().toISOString());
    }
  } catch (err) {
    console.error('MongoDB connection error at', new Date().toISOString(), ':', err);
    process.exit(1);
  }
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access token required', timestamp: new Date().toISOString() });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid token', timestamp: new Date().toISOString(), error: err.message });
  }
};

// Multer setup for multiple file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
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
    if (extname && mimetype) cb(null, true);
    else cb(new Error('Only images (jpeg, jpg, png) are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
}).array('images', 4);

// Shopify API Helper Functions
const shopifyApiBaseUrl = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-10`;
const shopifyApi = axios.create({
  baseURL: shopifyApiBaseUrl,
  headers: {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json',
  },
});

// Sync product with Shopify
const syncProductToShopify = async (product) => {
  try {
    console.log('Syncing product to Shopify at', new Date().toISOString(), ':', product);
    const shopifyProduct = {
      product: {
        title: product.name,
        body_html: product.description || '',
        vendor: 'Your Vendor Name',
        product_type: product.category || 'Uncategorized',
        images: product.imageUrls && product.imageUrls.length > 0
          ? product.imageUrls.map((url, index) => ({ src: url, position: index + 1 }))
          : [],
        variants: [{ price: product.price.toFixed(2), inventory_quantity: product.stock || 0, inventory_management: 'shopify' }],
        status: 'active',
      },
    };
    const response = await shopifyApi.post('/products.json', shopifyProduct);
    const shopifyProductId = response.data.product.id;
    await db.collection('products').updateOne(
      { _id: new ObjectId(product._id) },
      { $set: { shopifyProductId: shopifyProductId.toString() } }
    );
    console.log('Product synced with Shopify, ID:', shopifyProductId, 'at', new Date().toISOString());
    return shopifyProductId;
  } catch (err) {
    console.error('Shopify sync error at', new Date().toISOString(), ':', err.response ? err.response.data : err.message);
    throw new Error(`Failed to sync product with Shopify: ${err.message}`);
  }
};

// Update product on Shopify
const updateProductOnShopify = async (shopifyProductId, product) => {
  try {
    const shopifyProduct = {
      product: {
        id: shopifyProductId,
        title: product.name,
        body_html: product.description || '',
        product_type: product.category || 'Uncategorized',
        variants: [{ price: product.price.toFixed(2), inventory_quantity: product.stock || 0 }],
      },
    };
    if (product.imageUrls && product.imageUrls.length > 0) {
      shopifyProduct.product.images = product.imageUrls.map((url, index) => ({ src: url, position: index + 1 }));
    }
    const response = await shopifyApi.put(`/products/${shopifyProductId}.json`, shopifyProduct);
    console.log('Product updated on Shopify at', new Date().toISOString(), ':', response.data);
    return response.data;
  } catch (err) {
    console.error('Shopify update error at', new Date().toISOString(), ':', err.response ? err.response.data : err.message);
    throw new Error(`Failed to update product on Shopify: ${err.message}`);
  }
};

// Delete product from Shopify
const deleteProductFromShopify = async (shopifyProductId) => {
  try {
    await shopifyApi.delete(`/products/${shopifyProductId}.json`);
    console.log('Product deleted from Shopify at', new Date().toISOString(), ':', shopifyProductId);
  } catch (err) {
    console.error('Shopify delete error at', new Date().toISOString(), ':', err.response ? err.response.data : err.message);
    throw new Error(`Failed to delete product from Shopify: ${err.message}`);
  }
};

// API Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists', timestamp: new Date().toISOString() });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { name, email, password: hashedPassword, role: 'admin', createdAt: new Date() };
    const result = await db.collection('users').insertOne(newUser);

    const token = jwt.sign({ id: result.insertedId.toString(), email, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    const { password: _, ...userWithoutPassword } = newUser;
    userWithoutPassword._id = result.insertedId;

    res.status(201).json({ success: true, user: userWithoutPassword, token, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Registration error at', new Date().toISOString(), ':', err);
    res.status(500).json({ message: 'Server error during registration', error: err.message, timestamp: new Date().toISOString() });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials', timestamp: new Date().toISOString() });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials', timestamp: new Date().toISOString() });

    const token = jwt.sign({ id: user._id.toString(), email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    const { password: _, ...userWithoutPassword } = user;

    res.json({ success: true, user: userWithoutPassword, token, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Login error at', new Date().toISOString(), ':', err);
    res.status(500).json({ message: 'Server error during login', error: err.message, timestamp: new Date().toISOString() });
  }
});

app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching products for user:', req.user, 'at', new Date().toISOString());
    const products = await db.collection('products').find().toArray();
    console.log('Products found at', new Date().toISOString(), ':', products);
    res.json(products);
  } catch (err) {
    console.error('Error fetching products at', new Date().toISOString(), ':', err);
    res.status(500).json({ message: 'Server error fetching products', error: err.message, timestamp: new Date().toISOString() });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const product = { ...req.body, createdAt: new Date() };
    if (!product.name || !product.category) return res.status(400).json({ message: 'Name and category are required', timestamp: new Date().toISOString() });

    const result = await db.collection('products').insertOne(product);
    const insertedProduct = { ...product, _id: result.insertedId };

    const shopifyProductId = await syncProductToShopify(insertedProduct);
    insertedProduct.shopifyProductId = shopifyProductId.toString();

    console.log('Product created at', new Date().toISOString(), ':', insertedProduct);
    res.status(201).json(insertedProduct);
  } catch (err) {
    console.error('Error creating product at', new Date().toISOString(), ':', err);
    res.status(500).json({ message: 'Server error creating product', error: err.message, timestamp: new Date().toISOString() });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = { ...req.body };
    delete product._id;
    const existingProduct = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
    if (!existingProduct) return res.status(404).json({ message: 'Product not found', timestamp: new Date().toISOString() });

    await db.collection('products').updateOne({ _id: new ObjectId(req.params.id) }, { $set: product });

    if (existingProduct.shopifyProductId) {
      await updateProductOnShopify(existingProduct.shopifyProductId, { ...product, _id: req.params.id });
    } else {
      const shopifyProductId = await syncProductToShopify({ ...product, _id: req.params.id });
      await db.collection('products').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { shopifyProductId: shopifyProductId.toString() } });
    }

    console.log('Product updated at', new Date().toISOString(), ':', { ...existingProduct, ...product });
    res.json({ message: 'Product updated successfully', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error updating product at', new Date().toISOString(), ':', err);
    res.status(500).json({ message: 'Error updating product', error: err.message, timestamp: new Date().toISOString() });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const existingProduct = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
    if (!existingProduct) return res.status(404).json({ message: 'Product not found', timestamp: new Date().toISOString() });

    if (existingProduct.shopifyProductId) await deleteProductFromShopify(existingProduct.shopifyProductId);
    await db.collection('products').deleteOne({ _id: new ObjectId(req.params.id) });
    console.log('Product deleted at', new Date().toISOString(), ':', req.params.id);
    res.json({ message: 'Product deleted successfully', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error deleting product at', new Date().toISOString(), ':', err);
    res.status(500).json({ message: 'Server error deleting product', error: err.message, timestamp: new Date().toISOString() });
  }
});

app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await db.collection('orders').find().toArray();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching orders', error: err.message, timestamp: new Date().toISOString() });
  }
});

app.post('/api/upload', authenticateToken, (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message, timestamp: new Date().toISOString() });

    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No files uploaded', timestamp: new Date().toISOString() });

      const uploadPromises = req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, { folder: 'products', resource_type: 'image' });
        fs.unlinkSync(file.path);
        return result.secure_url;
      });

      const imageUrls = await Promise.all(uploadPromises);
      console.log('Images uploaded at', new Date().toISOString(), ':', imageUrls);
      res.json({ imageUrls, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('Error uploading images at', new Date().toISOString(), ':', err);
      res.status(500).json({ message: 'Server error uploading images', error: err.message, timestamp: new Date().toISOString() });
    }
  });
});

app.post('/api/ollama', authenticateToken, async (req, res) => {
  try {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ message: 'Prompt is required', timestamp: new Date().toISOString() });
    if (!type || !['text', 'image-description'].includes(type)) {
      return res.status(400).json({ message: "Type must be 'text' or 'image-description'", timestamp: new Date().toISOString() });
    }

    let ollamaPrompt;
    if (type === 'text') {
      ollamaPrompt = `Generate a product description for: ${prompt}`;
    } else if (type === 'image-description') {
      ollamaPrompt = `
        Generate a compelling, SEO-friendly product description for a Shopify store. Use the following details to create a description that is engaging, concise, and optimized for conversions. Ensure the tone is [insert tone, e.g., professional, friendly, luxurious, casual], and the description is between [insert word count, e.g., 100-150 words]. Include the following elements:
Product Name: ${prompt}
Category: [Insert category, e.g., clothing, electronics, home decor]
Key Features: [List 3-5 key features, e.g., material, size, functionality]
Benefits: [Describe 2-3 customer benefits, e.g., comfort, durability, convenience]
Target Audience: [Describe target audience, e.g., fitness enthusiasts, busy professionals]
Keywords for SEO: [List 3-5 keywords to incorporate naturally, e.g., organic cotton, wireless charger]
Call to Action: Include a strong call to action, e.g., "Shop now," "Add to cart today."
Structure the description as follows:
Opening Hook: Start with an engaging sentence to grab attention.
Features and Benefits: Highlight key features and how they benefit the customer.
Closing with CTA: End with a persuasive call to action.
Example (do not use this directly, generate a new description based on the provided details): Discover the ultimate comfort with our Eco-Friendly Bamboo T-Shirt! Crafted from 100% organic bamboo fabric, this lightweight, breathable shirt offers all-day comfort and durability. Perfect for eco-conscious fashion lovers, it’s hypoallergenic and moisture-wicking, keeping you fresh no matter the occasion. Available in multiple sizes, this versatile piece is a must-have for any wardrobe. Shop now and elevate your style sustainably!
Now, generate a product description based on the provided details.
      `;
    }

    console.log('Calling Ollama with prompt:', ollamaPrompt, 'at', new Date().toISOString());
 /*   const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'gemma3:1b',
      prompt: ollamaPrompt,
      stream: false,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 0, // Ajout d'un timeout de 10 secondes
    });

    if (!response.data || !response.data.response) {
      throw new Error('Invalid response from Ollama');
    }
*/
    console.log('Ollama response at', new Date().toISOString(), ':', response.data.response);
    res.json({ result: 'ollama response', type, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error with Ollama API at', new Date().toISOString(), ':', err.response ? err.response.data : err.message);
    res.status(500).json({
      message: 'Error with Ollama API',
      error: err.message,
      timestamp: new Date().toISOString(),
      result: 'Unable to generate content due to server error. Please try again later.',
    });
  }
});

// Start server
async function startServer() {
  await connectToMongo();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} at`, new Date().toISOString());
  });
}

startServer();