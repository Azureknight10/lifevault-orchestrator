const { syncFitbitMeals } = require("../vitalityHelpers");

function getTodayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = async function (context, req) {
  const dateStr = req.query.date || getTodayDateStr();

  try {
    const result = await syncFitbitMeals(dateStr);
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        success: true,
        syncDate: dateStr,
        data: result
      }
    };
  } catch (error) {
    context.log.error("FitbitMealsSync error", error.message);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: {
        success: false,
        syncDate: dateStr,
        error: error.message
      }
    };
  }
};
