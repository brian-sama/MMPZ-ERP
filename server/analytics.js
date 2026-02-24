
const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/multi-year', async (req, res) => {
  const { rows } = await db.query(`
    SELECT EXTRACT(YEAR FROM last_updated) AS year,
           AVG(performance_score) AS avg_performance,
           AVG(auto_risk_score) AS avg_risk
    FROM indicators
    GROUP BY year
    ORDER BY year;
  `);
  res.json(rows);
});

module.exports = router;
