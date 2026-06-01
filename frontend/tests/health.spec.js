import { test, expect, request } from '@playwright/test';

const BACKEND_BASE = 'http://localhost:5000';
const FRONTEND_BASE = 'http://localhost:3000';
const DEFAULT_ADMIN = { username: 'admin', password: 'admin123' };

const protectedApiRoutes = [
  { method: 'get', path: '/api/auth/me' },
  { method: 'post', path: '/api/auth/logout' },
  { method: 'get', path: '/api/products' },
  { method: 'get', path: '/api/orders' },
  { method: 'get', path: '/api/dashboard/stats' },
  { method: 'get', path: '/api/reports/sales' },
  { method: 'get', path: '/api/customers' },
  { method: 'get', path: '/api/warehouses' },
  { method: 'get', path: '/api/inventory/ledger' }
];

const frontendRoutes = [
  '/login',
  '/pos',
  '/dashboard',
  '/reports',
  '/customers',
  '/barcodes'
];

test.describe('TextTail full flow smoke tests', () => {
  test('Backend /health returns OK', async () => {
    const req = await request.newContext();
    const resp = await req.get(`${BACKEND_BASE}/health`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('OK');
    await req.dispose();
  });

  test('Admin login, auth refresh, protected access, and logout flow', async () => {
    const req = await request.newContext();
    const loginResp = await req.post(`${BACKEND_BASE}/api/auth/login`, {
      data: DEFAULT_ADMIN
    });
    expect(loginResp.status()).toBe(200);
    const loginBody = await loginResp.json();
    expect(loginBody.user.username).toBe(DEFAULT_ADMIN.username);
    expect(loginBody.accessToken).toBeTruthy();
    expect(loginBody.refreshToken).toBeTruthy();

    const authHeaders = {
      Authorization: `Bearer ${loginBody.accessToken}`
    };

    const meResp = await req.get(`${BACKEND_BASE}/api/auth/me`, { headers: authHeaders });
    expect(meResp.status()).toBe(200);
    const meBody = await meResp.json();
    expect(meBody.user?.username).toBe(DEFAULT_ADMIN.username);

    const refreshResp = await req.post(`${BACKEND_BASE}/api/auth/refresh-token`, {
      data: { token: loginBody.refreshToken }
    });
    expect(refreshResp.status()).toBe(200);
    const refreshBody = await refreshResp.json();
    expect(refreshBody.accessToken).toBeTruthy();

    const newAuthHeaders = {
      Authorization: `Bearer ${refreshBody.accessToken}`
    };
    const dashboardResp = await req.get(`${BACKEND_BASE}/api/dashboard/stats`, { headers: newAuthHeaders });
    expect(dashboardResp.status()).toBe(200);

    const logoutResp = await req.post(`${BACKEND_BASE}/api/auth/logout`, { headers: newAuthHeaders });
    expect(logoutResp.status()).toBe(200);

    const refreshAfterLogoutResp = await req.post(`${BACKEND_BASE}/api/auth/refresh-token`, {
      data: { token: loginBody.refreshToken }
    });
    expect(refreshAfterLogoutResp.status()).toBe(403);

    await req.dispose();
  });

  test('Order checkout flow updates stock and creates invoice', async () => {
    const req = await request.newContext();
    const loginResp = await req.post(`${BACKEND_BASE}/api/auth/login`, {
      data: DEFAULT_ADMIN
    });
    expect(loginResp.status()).toBe(200);
    const { accessToken } = await loginResp.json();
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const productsResp = await req.get(`${BACKEND_BASE}/api/products`, { headers: authHeaders });
    expect(productsResp.status()).toBe(200);
    const products = await productsResp.json();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);

    const product = products.find((item) => parseFloat(item.stock) > 0);
    expect(product).toBeTruthy();

    const initialStock = parseFloat(product.stock);
    const orderResp = await req.post(`${BACKEND_BASE}/api/orders`, {
      headers: authHeaders,
      data: {
        items: [
          {
            productId: product.id,
            quantity: 1,
            isReturn: false
          }
        ],
        discount: 0,
        couponCode: null,
        cgstAmount: 0,
        sgstAmount: 0,
        netAmount: product.price,
        paymentMethod: 'Cash',
        cashAmount: product.price,
        cardAmount: 0,
        upiAmount: 0,
        transactionType: 'Sale'
      }
    });

    expect(orderResp.status()).toBe(201);
    const orderBody = await orderResp.json();
    expect(orderBody.orderId).toBeTruthy();
    expect(orderBody.invoiceNumber).toMatch(/INV-/);

    const orderDetailResp = await req.get(`${BACKEND_BASE}/api/orders/${orderBody.orderId}`, { headers: authHeaders });
    expect(orderDetailResp.status()).toBe(200);
    const orderDetail = await orderDetailResp.json();
    expect(orderDetail.id || orderDetail.orderId).toBeTruthy();
    expect(orderDetail.invoice_number || orderDetail.invoiceNumber).toBe(orderBody.invoiceNumber);

    const productsAfterResp = await req.get(`${BACKEND_BASE}/api/products`, { headers: authHeaders });
    const productsAfter = await productsAfterResp.json();
    const updatedProduct = productsAfter.find((item) => item.id === product.id);
    expect(parseFloat(updatedProduct.stock)).toBe(initialStock - 1);

    await req.dispose();
  });

  for (const route of protectedApiRoutes) {
    test(`Protected API route ${route.method.toUpperCase()} ${route.path} rejects anonymous requests`, async () => {
      const req = await request.newContext();
      const response = await req[route.method](`${BACKEND_BASE}${route.path}`);
      expect(response.status()).toBeGreaterThanOrEqual(401);
      expect(response.status()).toBeLessThan(500);
      await req.dispose();
    });
  }

  for (const route of frontendRoutes) {
    test(`Frontend route ${route} serves HTML`, async () => {
      const req = await request.newContext();
      const resp = await req.get(`${FRONTEND_BASE}${route}`);
      expect(resp.status()).toBe(200);
      const html = await resp.text();
      expect(html).toMatch(/id="root"|<title>|<div id='root'/i);
      await req.dispose();
    });
  }
});
