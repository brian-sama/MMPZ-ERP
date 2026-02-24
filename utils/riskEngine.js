
function calculateRisk(indicator) {
  let score = 0;
  if (indicator.progress < 50 && indicator.budget_used > 80) score += 50;
  if (indicator.velocity <= 0) score += 20;
  if (indicator.days_since_update > 30) score += 30;
  return score;
}

function riskLevel(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

module.exports = { calculateRisk, riskLevel };
