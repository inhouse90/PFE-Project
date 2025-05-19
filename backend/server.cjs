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
    
    if (!(await db.listCollections({ name: 'orders' }).hasNext())) {
      await db.createCollection('orders');
    }
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
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
    if (!product.name) throw new Error('Product name is required');
    if (!product.price || product.price < 0) throw new Error('Valid product price is required');

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

    return shopifyProductId;
  } catch (err) {
    console.error('Error syncing product to Shopify:', err.message);
    throw new Error(`Failed to sync product with Shopify: ${err.message}`);
  }
};

// Update product on Shopify
const updateProductOnShopify = async (shopifyProductId, product) => {
  try {
    if (!product.name) throw new Error('Product name is required');
    if (product.price !== undefined && product.price < 0) throw new Error('Valid product price is required');

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
    return response.data;
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`Product with ID ${shopifyProductId} not found in Shopify, attempting to create new product`);
      return await syncProductToShopify({ ...product, _id: product._id });
    }
    console.error('Error updating product on Shopify:', err.message);
    throw new Error(`Failed to update product on Shopify: ${err.message}`);
  }
};

// Delete product from Shopify
const deleteProductFromShopify = async (shopifyProductId) => {
  try {
    await shopifyApi.delete(`/products/${shopifyProductId}.json`);
  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`Product with ID ${shopifyProductId} not found in Shopify, proceeding with local deletion`);
      return;
    }
    console.error('Error deleting product from Shopify:', err.message);
    throw new Error(`Failed to delete product from Shopify: ${err.message}`);
  }
};

// Sync products from Shopify
const syncProductsFromShopify = async () => {
  try {
    const response = await shopifyApi.get('/products.json');
    const shopifyProducts = response.data.products;

    const shopifyProductIds = shopifyProducts.map(p => p.id.toString());
    await db.collection('products').deleteMany({ shopifyProductId: { $nin: shopifyProductIds } });

    for (const shopifyProduct of shopifyProducts) {
      const existingProduct = await db.collection('products').findOne({ shopifyProductId: shopifyProduct.id.toString() });

      const productData = {
        name: shopifyProduct.title,
        description: shopifyProduct.body_html || '',
        price: parseFloat(shopifyProduct.variants[0].price) || 0,
        category: shopifyProduct.product_type || 'Uncategorized',
        stock: shopifyProduct.variants[0].inventory_quantity || 0,
        imageUrls: shopifyProduct.images.map(img => img.src) || [],
        createdAt: new Date(shopifyProduct.created_at),
        shopifyProductId: shopifyProduct.id.toString(),
      };

      if (existingProduct) {
        await db.collection('products').updateOne({ shopifyProductId: shopifyProduct.id.toString() }, { $set: productData });
      } else {
        await db.collection('products').insertOne(productData);
      }
    }
  } catch (err) {
    console.error('Error syncing products from Shopify:', err.message);
    throw new Error(`Failed to sync products from Shopify: ${err.message}`);
  }
};

// Sync orders from Shopify
const syncOrdersFromShopify = async () => {
  try {
    const response = await shopifyApi.get('/orders.json?status=any');
    const shopifyOrders = response.data.orders;

    const shopifyOrderIds = shopifyOrders.map(o => o.id.toString());
    await db.collection('orders').deleteMany({ shopifyOrderId: { $nin: shopifyOrderIds } });

    for (const shopifyOrder of shopifyOrders) {
      const existingOrder = await db.collection('orders').findOne({ shopifyOrderId: shopifyOrder.id.toString() });

      const orderData = {
        shopifyOrderId: shopifyOrder.id.toString(),
        orderNumber: shopifyOrder.order_number,
        customer: shopifyOrder.customer ? {
          firstName: shopifyOrder.customer.first_name || '',
          lastName: shopifyOrder.customer.last_name || '',
          email: shopifyOrder.customer.email || '',
          phone: shopifyOrder.customer.phone || '', // Ajout du numéro de téléphone
        } : null,
        totalPrice: parseFloat(shopifyOrder.total_price) || 0,
        currency: shopifyOrder.currency || 'MAD',
        status: shopifyOrder.financial_status || 'pending',
        fulfillmentStatus: shopifyOrder.fulfillment_status || 'unfulfilled',
        lineItems: shopifyOrder.line_items.map(item => ({
          productId: item.product_id?.toString() || '',
          variantId: item.variant_id?.toString() || '',
          title: item.title || '',
          quantity: item.quantity || 0,
          price: parseFloat(item.price) || 0,
        })) || [],
        createdAt: new Date(shopifyOrder.created_at),
        updatedAt: new Date(shopifyOrder.updated_at),
      };

      if (existingOrder) {
        await db.collection('orders').updateOne({ shopifyOrderId: shopifyOrder.id.toString() }, { $set: orderData });
      } else {
        await db.collection('orders').insertOne(orderData);
      }
    }
  } catch (err) {
    console.error('Error syncing orders from Shopify:', err.message);
    throw new Error(`Failed to sync orders from Shopify: ${err.message}`);
  }
};

// API Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { name, email, password: hashedPassword, role: 'admin', createdAt: new Date() };
    const result = await db.collection('users').insertOne(newUser);

    const token = jwt.sign({ id: result.insertedId.toString(), email, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
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
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id.toString(), email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
    const { password: _, ...userWithoutPassword } = user;

    res.json({ success: true, user: userWithoutPassword, token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Products Routes
app.get('/api/products', authenticateToken, async (req, res) => {
  try {
    await syncProductsFromShopify();
    const products = await db.collection('products').find().toArray();
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Server error fetching products', error: err.message });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    const product = { ...req.body, createdAt: new Date() };
    if (!product.name || !product.category) return res.status(400).json({ message: 'Name and category are required' });
    if (product.price < 0 || product.stock < 0) return res.status(400).json({ message: 'Price and stock must be positive numbers' });

    const result = await db.collection('products').insertOne(product);
    const insertedProduct = { ...product, _id: result.insertedId };

    const shopifyProductId = await syncProductToShopify(insertedProduct);
    insertedProduct.shopifyProductId = shopifyProductId.toString();

    res.status(201).json(insertedProduct);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ message: 'Server error creating product', error: err.message });
  }
});

app.get('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: 'Server error fetching product', error: err.message });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const product = { ...req.body };
    delete product._id;
    if (product.name && !product.name) return res.status(400).json({ message: 'Name is required' });
    if (product.category && !product.category) return res.status(400).json({ message: 'Category is required' });
    if (product.price !== undefined && product.price < 0) return res.status(400).json({ message: 'Price must be a positive number' });
    if (product.stock !== undefined && product.stock < 0) return res.status(400).json({ message: 'Stock must be a positive number' });

    const existingProduct = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
    if (!existingProduct) return res.status(404).json({ message: 'Product not found' });

    const result = await db.collection('products').updateOne({ _id: new ObjectId(req.params.id) }, { $set: product });

    if (existingProduct.shopifyProductId) {
      await updateProductOnShopify(existingProduct.shopifyProductId, { ...product, _id: req.params.id });
    } else {
      const shopifyProductId = await syncProductToShopify({ ...product, _id: req.params.id });
      await db.collection('products').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { shopifyProductId: shopifyProductId.toString() } });
    }

    res.json({ message: 'Product updated successfully', result });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Error updating product', error: err.message });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    const existingProduct = await db.collection('products').findOne({ _id: new ObjectId(req.params.id) });
    if (!existingProduct) return res.status(404).json({ message: 'Product not found' });

    if (existingProduct.shopifyProductId) await deleteProductFromShopify(existingProduct.shopifyProductId);
    await db.collection('products').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Server error deleting product', error: err.message });
  }
});

// Orders Routes
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    await syncOrdersFromShopify();
    const orders = await db.collection('orders').find().toArray();
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ message: 'Server error fetching orders', error: err.message });
  }
});

// Route: Get single order details
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const order = await db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({ message: 'Server error fetching order', error: err.message });
  }
});

// Route: Send confirmation email
app.post('/api/orders/:id/send-confirmation', authenticateToken, async (req, res) => {
  try {
    const order = await db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.customer || !order.customer.email) return res.status(400).json({ message: 'Customer email not found' });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: order.customer.email,
      subject: `Order Confirmation - #${order.orderNumber}`,
      html: `
        <h1>Order Confirmation</h1>
        <p>Dear ${order.customer.firstName} ${order.customer.lastName},</p>
        <p>Thank you for your order! Here are the details:</p>
        <ul>
          <li>Order Number: #${order.orderNumber}</li>
          <li>Date: ${new Date(order.createdAt).toLocaleDateString()}</li>
          <li>Total: ${order.totalPrice.toFixed(2)} ${order.currency}</li>
          <li>Payment Status: ${order.status}</li>
          <li>Fulfillment Status: ${order.fulfillmentStatus}</li>
        </ul>
        <h2>Items:</h2>
        <ul>
          ${order.lineItems.map(item => `
            <li>${item.title} - Quantity: ${item.quantity} - Price: ${item.price.toFixed(2)} ${order.currency}</li>
          `).join('')}
        </ul>
        <p>We will notify you once your order has shipped.</p>
        <p>Best regards,<br>Your Store Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Confirmation email sent successfully' });
  } catch (err) {
    console.error('Error sending confirmation email:', err);
    res.status(500).json({ message: 'Server error sending confirmation email', error: err.message });
  }
});

// New Route: Send confirmation SMS
app.post('/api/orders/:id/send-sms', authenticateToken, async (req, res) => {
  try {
    const order = await db.collection('orders').findOne({ _id: new ObjectId(req.params.id) });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.customer || !order.customer.phone) return res.status(400).json({ message: 'Customer phone number not found' });

    const message = `
      Order Confirmation #${order.orderNumber}
      Dear ${order.customer.firstName} ${order.customer.lastName},
      Thank you for your order!
      - Order Number: #${order.orderNumber}
      - Date: ${new Date(order.createdAt).toLocaleDateString()}
      - Total: ${order.totalPrice.toFixed(2)} ${order.currency}
      - Payment Status: ${order.status}
      - Fulfillment Status: ${order.fulfillmentStatus}
      Items:
      ${order.lineItems.map(item => `- ${item.title} (Qty: ${item.quantity}, Price: ${item.price.toFixed(2)} ${order.currency})`).join('\n')}
      We will notify you once your order has shipped.
      Best regards,
      Your Store Team
    `;

    await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: order.customer.phone,
    });

    res.json({ message: 'Confirmation SMS sent successfully' });
  } catch (err) {
    console.error('Error sending confirmation SMS:', err);
    res.status(500).json({ message: 'Server error sending confirmation SMS', error: err.message });
  }
});

// Image Upload Route
app.post('/api/upload', authenticateToken, (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

      const uploadPromises = req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, { folder: 'products', resource_type: 'image' });
        fs.unlinkSync(file.path);
        return result.secure_url;
      });

      const imageUrls = await Promise.all(uploadPromises);
      res.json({ imageUrls });
    } catch (err) {
      console.error('Error uploading images to Cloudinary:', err);
      res.status(500).json({ message: 'Server error uploading images', error: err.message });
    }
  });
});

// Serve React frontend
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