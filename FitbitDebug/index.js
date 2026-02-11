const { TableClient } = require("@azure/data-tables");

const ACCOUNT_CONN =
  process.env.TABLE_ACCOUNT_CONN || process.env.AzureWebJobsStorage;
const ACTIVITY_TABLE = "DailyActivity";
const SLEEP_TABLE = "SleepLog";

module.exports = async function (context, req) {
  const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
  const partitionKey = req.query.partitionKey || "fitbit";

  const activityClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    ACTIVITY_TABLE
  );
  const sleepClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    SLEEP_TABLE
  );

  const [activityResult, sleepResult] = await Promise.allSettled([
    activityClient.getEntity(partitionKey, dateStr),
    sleepClient.getEntity(partitionKey, dateStr),
  ]);

  const activity =
    activityResult.status === "fulfilled" ? activityResult.value : null;
  const sleep = sleepResult.status === "fulfilled" ? sleepResult.value : null;

  if (activityResult.status === "rejected") {
    context.log(
      "FitbitDebug activity error",
      activityResult.reason?.message || activityResult.reason
    );
  }

  if (sleepResult.status === "rejected") {
    context.log(
      "FitbitDebug sleep error",
      sleepResult.reason?.message || sleepResult.reason
    );
  }

  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: {
      date: dateStr,
      partitionKey,
      activity,
      sleep,
    },
  };
};
