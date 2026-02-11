const { syncFitbitData } = require("../vitalityHelpers");

function getYesterdayDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

module.exports = async function (context, req) {
  const dateStr = req.query.date || getYesterdayDateStr();

  try {
    const result = await syncFitbitData(dateStr);
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
    context.log.error("FitbitSyncManual error", error.message);
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
