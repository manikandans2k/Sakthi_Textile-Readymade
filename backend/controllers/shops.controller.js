const db = require('../config/db');

/**
 * Return basic shop details for a given shop id.
 * Accessible by Super Admin or users belonging to the same shop.
 */
exports.getShopById = async (req, res, next) => {
  try {
    const shopId = parseInt(req.params.id, 10);
    if (isNaN(shopId)) return res.status(400).json({ message: 'Invalid shop id.' });

    // Authorization: allow if requester is Super Admin or belongs to the same shop
    if (req.user.role !== 'Super Admin' && req.user.shop_id !== shopId) {
      return res.status(403).json({ message: 'Forbidden. You do not have permissions to access this shop.' });
    }

    const [rows] = await db.query('SELECT id, shop_name, owner_name, mobile, email, gst_number, address, gst_enabled FROM shops WHERE id = ?', [shopId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Shop not found.' });
    }

    res.json({ shop: rows[0] });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle shop GST billing settings.
 * Accessible by Super Admin or Shop Owner/Manager belonging to the same shop.
 */
exports.updateShopGst = async (req, res, next) => {
  try {
    const shopId = parseInt(req.params.id, 10);
    const { gst_enabled } = req.body;

    if (isNaN(shopId)) return res.status(400).json({ message: 'Invalid shop id.' });

    // Authorization: allow if requester is Super Admin or Shop Owner/Manager in same shop
    if (req.user.role !== 'Super Admin' && req.user.shop_id !== shopId) {
      return res.status(403).json({ message: 'Forbidden. You do not have permissions to modify this shop configuration.' });
    }

    const gstVal = gst_enabled !== false && gst_enabled !== 0 && gst_enabled !== 'false' ? 1 : 0;
    const [result] = await db.query('UPDATE shops SET gst_enabled = ? WHERE id = ?', [gstVal, shopId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Shop not found.' });
    }

    res.json({ 
      message: `Shop GST billing status updated to ${gstVal ? 'ENABLED' : 'DISABLED'} successfully.`,
      gst_enabled: !!gstVal
    });
  } catch (error) {
    next(error);
  }
};
