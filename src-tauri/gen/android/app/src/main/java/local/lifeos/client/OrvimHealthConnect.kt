package local.lifeos.client

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.ext.SdkExtensions
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId

// Loaded only on Android 9+. Health Connect is optional; no writer, background
// service, route/location access or continuous sensor polling is installed.
class OrvimHealthConnect(private val activity: Activity) {
  private val provider = "com.google.android.apps.healthdata"
  private val permissionMap = mapOf(
    "steps" to HealthPermission.getReadPermission(StepsRecord::class),
    "sleep" to HealthPermission.getReadPermission(SleepSessionRecord::class),
    "workouts" to HealthPermission.getReadPermission(ExerciseSessionRecord::class)
  )
  private val contract = PermissionController.createRequestPermissionResultContract()
  private fun client() = HealthConnectClient.getOrCreate(activity)
  private fun selected(args: JSONObject): Set<String> {
    val array = args.optJSONArray("categories") ?: JSONArray()
    return (0 until array.length()).map { array.getString(it) }.toSet().also {
      require(it.isNotEmpty() && permissionMap.keys.containsAll(it)) { "Выберите шаги, сон или тренировки" }
    }
  }
  fun permissionIntent(args: JSONObject): Intent {
    check(HealthConnectClient.getSdkStatus(activity) == HealthConnectClient.SDK_AVAILABLE) { "Установите или обновите Health Connect" }
    return contract.createIntent(activity, selected(args).map { permissionMap.getValue(it) }.toSet())
  }
  fun status(): JSONObject = runBlocking {
    val availability = HealthConnectClient.getSdkStatus(activity)
    val status = when(availability) {
      HealthConnectClient.SDK_AVAILABLE -> "available"
      HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "install"
      else -> "unsupported"
    }
    val granted = if(status == "available") client().permissionController.getGrantedPermissions() else emptySet()
    val categories = permissionMap.filterValues { it in granted }.keys
    val phoneSteps = Build.VERSION.SDK_INT >= 34 && SdkExtensions.getExtensionVersion(34) >= 20
    JSONObject().put("status", status).put("granted", JSONArray(categories.toList())).put("phoneSteps", phoneSteps)
      .put("message", when(status) {
        "install" -> "Установите или обновите Health Connect из Google Play."
        "unsupported" -> "Health Connect недоступен на этом устройстве. Нужен Android 9+ с Google Play Services, без рабочего профиля. Ручные записи доступны."
        else -> if(categories.isEmpty()) "Выберите данные и разрешите чтение в окне Android." else "Доступно: ${categories.joinToString { when(it) { "steps" -> "шаги"; "sleep" -> "сон"; else -> "тренировки" } }}."
      })
  }
  fun openSettings() {
    activity.startActivity(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
  fun install() {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$provider"))
    try { activity.startActivity(intent) }
    catch (_: Exception) { activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$provider"))) }
  }
  fun read(args: JSONObject): JSONObject = runBlocking {
    val state = status()
    if(state.getString("status") != "available") return@runBlocking state
    val selected = selected(args)
    val granted = client().permissionController.getGrantedPermissions()
    val enabled = selected.filter { permissionMap.getValue(it) in granted }.toSet()
    val days = args.optInt("days", 30).coerceIn(1, 30)
    val zone = ZoneId.systemDefault()
    val dayStartMinutes = args.optInt("dayStartMinutes", 0).coerceIn(0, 1439)
    val dayStart = java.time.LocalTime.of(dayStartMinutes / 60, dayStartMinutes % 60)
    val now = java.time.ZonedDateTime.now(zone)
    val date = if(now.toLocalTime() < dayStart) now.toLocalDate().minusDays(1) else now.toLocalDate()
    val from = date.minusDays(days.toLong() - 1)
    val localStart = from.atTime(dayStart)
    val start = localStart.atZone(zone).toInstant()
    val end = Instant.now()
    val warnings = JSONArray()
    val steps = JSONArray()
    val sleep = JSONArray()
    val workouts = JSONArray()
    val successful = mutableSetOf<String>()
    if("steps" in enabled) try {
      // Health Connect aggregates and deduplicates overlapping phone/watch data.
      val buckets = client().aggregateGroupByPeriod(AggregateGroupByPeriodRequest(
        metrics = setOf(StepsRecord.COUNT_TOTAL),
        timeRangeFilter = TimeRangeFilter.between(localStart, end.atZone(zone).toLocalDateTime()),
        timeRangeSlicer = Period.ofDays(1)
      ))
      for(bucket in buckets) {
        val count = bucket.result[StepsRecord.COUNT_TOTAL] ?: continue
        steps.put(JSONObject().put("date", bucket.startTime.toLocalDate().toString()).put("count", count)
          .put("dayStartMinutes", dayStartMinutes)
          .put("origins", JSONArray(bucket.result.dataOrigins.map { it.packageName })))
      }
      successful.add("steps")
    } catch(_: Exception) { warnings.put("Шаги не обновились. Проверьте доступ и повторите позже") }
    if("sleep" in enabled) try {
      var token: String? = null
      do {
        val page = client().readRecords(ReadRecordsRequest(SleepSessionRecord::class,
          TimeRangeFilter.between(start, end), pageSize = 500, pageToken = token))
        for(record in page.records) {
          check(sleep.length() < 5000) { "Слишком много записей сна" }
          // Retain unclassified sleep time, subtract known awake/out-of-bed stages.
          val awake = record.stages.filter { it.stage in setOf(SleepSessionRecord.STAGE_TYPE_AWAKE,
            SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED, SleepSessionRecord.STAGE_TYPE_OUT_OF_BED) }
            .sortedBy { it.startTime }
          val intervals = JSONArray()
          var cursor = record.startTime
          for(stage in awake) {
            val awakeStart = maxOf(record.startTime, stage.startTime)
            val awakeEnd = minOf(record.endTime, stage.endTime)
            if(awakeStart > cursor) intervals.put(JSONArray(listOf(cursor.toEpochMilli(), awakeStart.toEpochMilli())))
            cursor = maxOf(cursor, awakeEnd)
          }
          if(cursor < record.endTime) intervals.put(JSONArray(listOf(cursor.toEpochMilli(), record.endTime.toEpochMilli())))
          sleep.put(JSONObject().put("key", record.metadata.dataOrigin.packageName + ":" + record.metadata.id)
            .put("origin", record.metadata.dataOrigin.packageName)
            .put("date", record.endTime.atZone(zone).let { if(it.toLocalTime() < dayStart) it.toLocalDate().minusDays(1) else it.toLocalDate() }.toString())
            .put("start", record.startTime.toEpochMilli()).put("end", record.endTime.toEpochMilli())
            .put("intervals", intervals))
        }
        token = page.pageToken
      } while(!token.isNullOrEmpty())
      successful.add("sleep")
    } catch(_: Exception) { sleep.clear(); warnings.put("Сон не обновился. Проверьте доступ и повторите позже") }
    if("workouts" in enabled) try {
      var token: String? = null
      do {
        val page = client().readRecords(ReadRecordsRequest(ExerciseSessionRecord::class,
          TimeRangeFilter.between(start, end), pageSize = 500, pageToken = token))
        for(record in page.records) {
          check(workouts.length() < 2000) { "Слишком много тренировок" }
          val duration = Duration.between(record.startTime, record.endTime).toMinutes().coerceAtLeast(1)
          if(duration > 1439) { warnings.put("Тренировка длиннее суток пропущена"); continue }
          val local = record.startTime.atZone(zone)
          val item = JSONObject().put("key", record.metadata.dataOrigin.packageName + ":" + record.metadata.id)
            .put("origin", record.metadata.dataOrigin.packageName)
            .put("start", record.startTime.toEpochMilli()).put("end", record.endTime.toEpochMilli())
            .put("updatedAt", record.metadata.lastModifiedTime.toEpochMilli())
            .put("date", local.toLocalDate().toString()).put("time", String.format("%02d:%02d", local.hour, local.minute))
            .put("duration", duration).put("name", record.title?.takeIf { it.isNotBlank() } ?: exerciseName(record.exerciseType))
            .put("exerciseType", record.exerciseType)
          if("steps" in enabled) try {
            val aggregate = client().aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL),
              TimeRangeFilter.between(record.startTime, record.endTime)))
            aggregate[StepsRecord.COUNT_TOTAL]?.let { item.put("steps", it) }
          } catch(_: Exception) { /* Steps unavailable for this session: no fabricated zero. */ }
          workouts.put(item)
        }
        token = page.pageToken
      } while(!token.isNullOrEmpty())
      successful.add("workouts")
    } catch(_: Exception) { workouts.clear(); warnings.put("Тренировки не обновились. Проверьте доступ и повторите позже") }
    for(category in selected - enabled) warnings.put("Нет доступа: " + when(category) { "steps" -> "шаги"; "sleep" -> "сон"; else -> "тренировки" })
    JSONObject().put("status", "available").put("granted", JSONArray(successful.toList()))
      .put("steps", steps).put("sleep", sleep).put("workouts", workouts).put("warnings", warnings)
      .put("at", System.currentTimeMillis())
  }
  private fun exerciseName(type: Int): String = when(type) {
    ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "Бег"
    ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "Ходьба"
    ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "Велосипед"
    ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING -> "Силовая тренировка"
    ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL -> "Плавание"
    ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "Йога"
    else -> "Тренировка"
  }
  private fun JSONArray.clear() { while(length() > 0) remove(length() - 1) }
}
