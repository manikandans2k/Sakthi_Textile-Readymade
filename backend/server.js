const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const db = require('./config/db');
const { generalApiLimiter, xssPayloadSanitizer, secureErrorHandler } = require('./middleware/security');

// Route imports
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const customerRoutes = require('./routes/customer.routes');
const warehouseRoutes = require('./routes/warehouse.routes');
const supplierRoutes = require('./routes/supplier.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const reportRoutes = require('./routes/report.routes');
const barcodeRoutes = require('./routes/barcode.routes');
const saasRoutes = require('./routes/saas.routes');
const shopsRoutes = require('./routes/shops.routes');
const employeeRoutes = require('./routes/employee.routes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable trust proxy so Express correctly handles client IPs behind Render's load balancer
app.set('trust proxy', 1);

// CORS setup: restrict origins in production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000'
];

if (process.env.FRONTEND_URL) {
  // Normalize by stripping any trailing slash
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (like server-to-server, mobile app tests, or Postman)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.endsWith('.onrender.com') ||
                      (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:'));
                      
    if (isAllowed) {
      return callback(null, true);
    }
    return callback(new Error(`CORS Policy: Origin ${origin} is unauthorized.`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Enforce standard Helmet headers for secure HTTP headers (protect against clickjacking, XSS, etc.)
app.use(helmet());

// Clean query strings, URL parameters, and body inputs recursively against malicious HTML injections
app.use(xssPayloadSanitizer);

// Protect overall server load by limiting requests per IP window on active APIs
app.use('/api', generalApiLimiter);

// API Routes mounting
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/barcodes', barcodeRoutes);
app.use('/api/saas', saasRoutes);
app.use('/api/shops', shopsRoutes);
app.use('/api/employees', employeeRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date(), service: 'Textile POS ERP API' });
});

// Centralized secure error handler (conceals system stack traces in production environment)
app.use(secureErrorHandler);

// Initialize database and start server
async function startServer() {
  console.log('Starting Textile POS ERP API Server...');
  await db.initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Backend Server is successfully listening on port ${PORT}`);
    console.log(`Health Check: http://localhost:${PORT}/health`);
    console.log(`==================================================`);
  });
}

startServer();
