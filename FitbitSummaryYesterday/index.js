// FitbitSummaryYesterday/index.js
const { TableClient } = require("@azure/data-tables");

const ACCOUNT_CONN = process.env.TABLE_ACCOUNT_CONN || process.env.AzureWebJobsStorage;
const PARTITION_KEY = process.env.FITBIT_PARTITION_KEY || "USER_shane-dev-001";
const ACTIVITY_TABLE = "DailyActivity";
const SLEEP_TABLE = "SleepLog";
const HEART_TABLE = "HeartRateLog";
const WORKOUT_TABLE = "WorkoutLog";
const READINESS_TABLE = "ReadinessLog";
const HRV_TABLE = "HrvLog";
const SPO2_TABLE = "Spo2Log";
const SKIN_TEMP_TABLE = "SkinTempLog";
const CARDIO_TABLE = "CardioFitnessLog";
const SLEEP_SCORE_TABLE = "SleepScoreLog";

function getYesterdayDateStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stressFromRmssd(rmssd, min = 20, max = 100) {
  if (rmssd === null || rmssd === undefined) return null;
  const normalized = clamp((rmssd - min) / (max - min), 0, 1);
  return Math.round((1 - normalized) * 100);
}

module.exports = async function (context, req) {
  const dateStr = req.query.date || getYesterdayDateStr();

  const activityClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    ACTIVITY_TABLE
  );
  const sleepClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    SLEEP_TABLE
  );
  const heartClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    HEART_TABLE
  );
  const workoutClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    WORKOUT_TABLE
  );
  const readinessClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    READINESS_TABLE
  );
  const hrvClient = TableClient.fromConnectionString(ACCOUNT_CONN, HRV_TABLE);
  const spo2Client = TableClient.fromConnectionString(ACCOUNT_CONN, SPO2_TABLE);
  const skinTempClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    SKIN_TEMP_TABLE
  );
  const cardioClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    CARDIO_TABLE
  );
  const sleepScoreClient = TableClient.fromConnectionString(
    ACCOUNT_CONN,
    SLEEP_SCORE_TABLE
  );

  try {
    const [
      activityResult,
      sleepResult,
      heartResult,
      readinessResult,
      hrvResult,
      spo2Result,
      skinTempResult,
      cardioResult,
      sleepScoreResult
    ] =
      await Promise.allSettled([
        activityClient.getEntity(PARTITION_KEY, dateStr),
        sleepClient.getEntity(PARTITION_KEY, dateStr),
        heartClient.getEntity(PARTITION_KEY, dateStr),
        readinessClient.getEntity(PARTITION_KEY, dateStr),
        hrvClient.getEntity(PARTITION_KEY, dateStr),
        spo2Client.getEntity(PARTITION_KEY, dateStr),
        skinTempClient.getEntity(PARTITION_KEY, dateStr),
        cardioClient.getEntity(PARTITION_KEY, dateStr),
        sleepScoreClient.getEntity(PARTITION_KEY, dateStr)
      ]);

    const activity =
      activityResult.status === "fulfilled" ? activityResult.value : null;
    const sleep = sleepResult.status === "fulfilled" ? sleepResult.value : null;
    const heart =
      heartResult.status === "fulfilled" ? heartResult.value : null;
    const readiness =
      readinessResult.status === "fulfilled" ? readinessResult.value : null;
    const hrv = hrvResult.status === "fulfilled" ? hrvResult.value : null;
    const spo2 = spo2Result.status === "fulfilled" ? spo2Result.value : null;
    const skinTemp =
      skinTempResult.status === "fulfilled" ? skinTempResult.value : null;
    const cardio =
      cardioResult.status === "fulfilled" ? cardioResult.value : null;
    const sleepScore =
      sleepScoreResult.status === "fulfilled" ? sleepScoreResult.value : null;

    if (activityResult.status === "rejected") {
      context.log("FitbitSummaryYesterday activity error", activityResult.reason);
    }
    if (sleepResult.status === "rejected") {
      context.log("FitbitSummaryYesterday sleep error", sleepResult.reason);
    }
    if (heartResult.status === "rejected") {
      context.log("FitbitSummaryYesterday heart error", heartResult.reason);
    }
    if (readinessResult.status === "rejected") {
      context.log(
        "FitbitSummaryYesterday readiness error",
        readinessResult.reason
      );
    }
    if (hrvResult.status === "rejected") {
      context.log("FitbitSummaryYesterday hrv error", hrvResult.reason);
    }
    if (spo2Result.status === "rejected") {
      context.log("FitbitSummaryYesterday spo2 error", spo2Result.reason);
    }
    if (skinTempResult.status === "rejected") {
      context.log(
        "FitbitSummaryYesterday skin temp error",
        skinTempResult.reason
      );
    }
    if (cardioResult.status === "rejected") {
      context.log("FitbitSummaryYesterday cardio error", cardioResult.reason);
    }
    if (sleepScoreResult.status === "rejected") {
      context.log(
        "FitbitSummaryYesterday sleep score error",
        sleepScoreResult.reason
      );
    }

    const sleepMinutes =
      sleep?.minutesAsleep ??
      sleep?.totalMinutesAsleep ??
      (sleep?.duration != null ? Math.round(sleep.duration / 60000) : null);

    const restingHeartRate =
      heart?.restingHeartRate ??
      activity?.restingHR ??
      activity?.restingHeartRate ??
      null;

    const activeMinutes =
      activity?.activeMinutes ??
      activity?.activeMins ??
      (activity?.veryActiveMinutes != null || activity?.fairlyActiveMinutes != null
        ? toNumber(activity?.veryActiveMinutes) +
          toNumber(activity?.fairlyActiveMinutes)
        : null);

    const caloriesBurned =
      activity?.caloriesBurned ??
      activity?.caloriesOut ??
      activity?.calories ??
      null;

    const workouts = [];
    try {
      const filter = `PartitionKey eq '${PARTITION_KEY}' and date eq '${dateStr}'`;
      for await (const entity of workoutClient.listEntities({ filter })) {
        workouts.push(entity);
      }
    } catch (err) {
      context.log("FitbitSummaryYesterday workouts error", err?.message || err);
    }

    const workoutsCount = workouts.length;
    const workoutsSummary = workoutsCount
      ? workouts
          .map((workout) => {
            const name = workout.activityName || "Workout";
            const minutes =
              workout.duration != null
                ? Math.round(Number(workout.duration))
                : null;
            return minutes != null ? `${name} ${minutes} min` : name;
          })
          .join(" · ")
      : "";

    const trendScore = Math.round(
      clamp((toNumber(activity?.steps, 0) / 10000) * 100, 0, 100)
    );
    const recoveryScore =
      readiness?.readinessScore != null
        ? toNumber(readiness?.readinessScore)
        : activity?.readinessScore != null
        ? toNumber(activity?.readinessScore)
        : sleep?.efficiency != null
        ? toNumber(sleep?.efficiency)
        : 0;
    const stressScore =
      hrv?.hrvRmssd != null
        ? stressFromRmssd(Number(hrv.hrvRmssd))
        : heart?.hrvRmssd != null
        ? stressFromRmssd(Number(heart.hrvRmssd))
        : 0;

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        date: dateStr,
        steps: activity?.steps ?? 0,
        activeMinutes: toNumber(activeMinutes),
        caloriesBurned: toNumber(caloriesBurned),
        distance: toNumber(activity?.distance),
        lastSync: activity?.lastSync ?? null,
        source: activity?.source ?? null,
        restingHeartRate,
        sleepHours: sleepMinutes != null ? sleepMinutes / 60 : 0,
        readinessScore: readiness?.readinessScore ?? activity?.readinessScore ?? null,
        hrvRmssd: hrv?.hrvRmssd ?? heart?.hrvRmssd ?? null,
        hrvSdnn: hrv?.hrvSdnn ?? heart?.hrvSdnn ?? null,
        spo2Avg: spo2?.spo2Avg ?? null,
        spo2Min: spo2?.spo2Min ?? null,
        spo2Max: spo2?.spo2Max ?? null,
        skinTempRelative: skinTemp?.skinTempRelative ?? null,
        skinTempAbsolute: skinTemp?.skinTempAbsolute ?? null,
        cardioFitness: cardio?.cardioFitness ?? null,
        sleepScore: sleepScore?.sleepScore ?? null,
        trendScore,
        recoveryScore,
        stressScore,
        workoutsCount,
        workoutsSummary,
      },
    };
  } catch (err) {
    context.log("FitbitSummaryYesterday error", err.message);
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        date: dateStr,
        steps: 0,
        activeMinutes: 0,
        caloriesBurned: 0,
        distance: 0,
        lastSync: null,
        source: null,
        restingHeartRate: null,
        sleepHours: 0,
        readinessScore: null,
        hrvRmssd: null,
        hrvSdnn: null,
        spo2Avg: null,
        spo2Min: null,
        spo2Max: null,
        skinTempRelative: null,
        skinTempAbsolute: null,
        cardioFitness: null,
        sleepScore: null,
        trendScore: 0,
        recoveryScore: 0,
        stressScore: 0,
        workoutsCount: 0,
        workoutsSummary: "",
      },
    };
  }
};
