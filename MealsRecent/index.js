const { TableClient } = require("@azure/data-tables");

const ACCOUNT_CONN =
  process.env.TABLE_ACCOUNT_CONN ||
  process.env.AzureWebJobsStorage ||
  process.env.AZURE_STORAGE_CONNECTION_STRING;
const MEAL_TABLE = "MealLog";
const DEFAULT_PARTITION = "USER_DEFAULT";

function normalizePartitionKey(userId) {
  if (!userId || userId === "user-1") return DEFAULT_PARTITION;
  return userId;
}

module.exports = async function (context, req) {
  const userId = req.query.userId;
  const limit = Number(req.query.limit || 5);
  const partitionKey = normalizePartitionKey(userId);

  const mealClient = TableClient.fromConnectionString(ACCOUNT_CONN, MEAL_TABLE);

  try {
    const filter = `PartitionKey eq '${partitionKey}'`;
    const entities = [];

    for await (const entity of mealClient.listEntities({
      queryOptions: { filter }
    })) {
      entities.push(entity);
    }

    entities.sort((a, b) => String(b.rowKey).localeCompare(String(a.rowKey)));
    const recent = entities.slice(0, Number.isNaN(limit) ? 5 : limit);

    const mapped = recent.map((meal) => ({
      Description: meal.mealName || meal.Description || "Meal",
      Calories: meal.totalCalories ?? meal.Calories ?? null,
      Protein: meal.totalProtein ?? meal.Protein ?? null,
      Carbs: meal.totalCarbs ?? meal.Carbs ?? null,
      Fat: meal.totalFat ?? meal.Fat ?? null
    }));

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: mapped
    };
  } catch (error) {
    context.log("MealsRecent error", error.message);
    context.res = {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: error.message }
    };
  }
};
