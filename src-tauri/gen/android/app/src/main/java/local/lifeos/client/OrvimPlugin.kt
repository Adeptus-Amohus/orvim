package local.lifeos.client

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.CalendarContract
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.speech.RecognizerIntent
import android.util.Base64
import android.webkit.WebView
import androidx.activity.result.ActivityResult
import androidx.core.content.ContextCompat
import app.tauri.annotation.*
import app.tauri.plugin.*
import org.json.JSONObject
import org.json.JSONArray
import java.security.KeyStore
import java.time.*
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import com.journeyapps.barcodescanner.ScanOptions
import com.journeyapps.barcodescanner.ScanContract
import com.google.zxing.client.android.Intents

@TauriPlugin(permissions = [
  Permission(strings=[Manifest.permission.POST_NOTIFICATIONS], alias="notifications"),
  Permission(strings=[Manifest.permission.RECORD_AUDIO], alias="microphone"),
  Permission(strings=[Manifest.permission.READ_CALENDAR,Manifest.permission.WRITE_CALENDAR], alias="calendar")
])
class OrvimPlugin(private val activity: Activity): Plugin(activity) {
  private val dictation=OrvimDictation(activity)
  private val backups=OrvimBackups(activity)
  private val health by lazy { OrvimHealthConnect(activity) }
  private var webView: WebView? = null
  private var pendingPairingLink: String? = null
  private var pairingReady = false
  private var widgetReady = false
  private var pendingWidgetAction: JSONObject? = null
  override fun load(webView: WebView) { this.webView=webView;pairingReady=false;widgetReady=false }
  private fun allowed(permission:String) = ContextCompat.checkSelfPermission(activity,permission)==PackageManager.PERMISSION_GRANTED
  private fun resolve(invoke:Invoke,value:JSONObject) {invoke.resolve(JSObject(value.toString()))}
  @Command fun action(invoke:Invoke) {
    val request=JSONObject(invoke.getRawArgs())
    val operation=request.getString("operation")
    val args=request.optJSONObject("payload") ?: JSONObject()
    try {
      when(operation) {
        "widgetAction" -> {widgetReady=true;val action=pendingWidgetAction ?: OrvimWidgets.takeAction(activity,activity.intent);pendingWidgetAction=null;resolve(invoke,action ?: JSONObject())}
        "scanPairingCode" -> activity.runOnUiThread {
          try {
            val options=ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE)
              .setPrompt("Наведите камеру на QR-код Orvim на ПК")
              .setOrientationLocked(false).setBeepEnabled(false)
            startActivityForResult(invoke,options.createScanIntent(activity),"pairingScanResult")
          } catch(error:Exception) {invoke.reject(error.message ?: "Камера недоступна. Введите адрес ПК и код вручную.")}
        }
        "healthPermission" -> {
          if(Build.VERSION.SDK_INT < 28) resolve(invoke,healthUnavailable())
          else startActivityForResult(invoke,health.permissionIntent(args),"healthPermissionResult")
        }
        "healthInstall","healthSettings" -> activity.runOnUiThread {
          try {
            if(Build.VERSION.SDK_INT < 28) resolve(invoke,healthUnavailable())
            else { if(operation=="healthInstall")health.install()else health.openSettings(); resolve(invoke,JSONObject().put("opened",true)) }
          } catch(error:Exception) { invoke.reject(error.message ?: "Health Connect недоступен") }
        }
        "backupFolder" -> startActivityForResult(invoke,backups.intent(),"backupFolderResult")
        "speechStart" -> {
          if(!allowed(Manifest.permission.RECORD_AUDIO))requestPermissionForAlias("microphone",invoke,"microphoneResult")
          else activity.runOnUiThread {try{resolve(invoke,dictation.start(args))}catch(error:Exception){invoke.reject(error.message ?: "Микрофон недоступен")}}
        }
        "speechPoll" -> activity.runOnUiThread {resolve(invoke,dictation.snapshot())}
        "speechDownload" -> activity.runOnUiThread {try{resolve(invoke,dictation.downloadModel(args))}catch(error:Exception){invoke.reject(error.message ?: "Установите речевой пакет в настройках Android")}}
        "speechStop" -> activity.runOnUiThread {resolve(invoke,dictation.stop())}
        "notificationPermission" -> {
          if(Build.VERSION.SDK_INT>=33 && !allowed(Manifest.permission.POST_NOTIFICATIONS)) requestPermissionForAlias("notifications",invoke,"notificationPermissionResult")
          else resolve(invoke,JSONObject().put("message",notificationStatus()))
        }
        "calendarPermission" -> {
          if(!allowed(Manifest.permission.READ_CALENDAR)||!allowed(Manifest.permission.WRITE_CALENDAR)) requestPermissionForAlias("calendar",invoke,"calendarPermissionResult")
          else resolve(invoke,JSONObject().put("granted",true))
        }
        "speech" -> {
          val intent=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE,when(args.optString("language").take(2)){"ru"->"ru-RU";else->"en-US"})
            .putExtra(RecognizerIntent.EXTRA_PROMPT,"Orvim")
          startActivityForResult(invoke,intent,"speechResult")
        }
        "pairingLink" -> {pairingReady=true;val link=pendingPairingLink ?: activity.intent.dataString ?: "";pendingPairingLink=null;activity.intent.data=null;resolve(invoke,JSONObject().put("link",link))}
        "notificationClick" -> {val kind=activity.intent.getStringExtra("lifeKind") ?: "";activity.intent.removeExtra("lifeKind");resolve(invoke,JSONObject().put("kind",kind))}
        else -> Thread {
          try {
            val result=when(operation) {
              "widgetPending" -> JSONObject().put("commands",OrvimWidgets.pending(activity))
              "widgetReset" -> {OrvimWidgets.clear(activity);JSONObject().put("cleared",true)}
              "widgetAck" -> {OrvimWidgets.ack(activity,args.optJSONArray("keys") ?: JSONArray());JSONObject().put("acknowledged",true)}
              "widgetUpdate" -> {OrvimWidgets.save(activity,args);JSONObject().put("updated",true)}
              "healthStatus" -> if(Build.VERSION.SDK_INT >= 28)health.status()else healthUnavailable()
              "healthRead" -> if(Build.VERSION.SDK_INT >= 28)health.read(args)else healthUnavailable()
              "credential" -> credential(args)
              "installPackage" -> installPackage(args)
              "backupMirror","backupFolderStatus","backupExternalList","backupExternalRead","backupExternalDelete" -> backups.action(operation,args)
              "reminders" -> {LifeAlarms.update(activity,args);JSONObject().put("message",if(args.optBoolean("enabled",true))notificationStatus() else "Уведомления выключены.")}
              "calendarList" -> calendarList()
              "calendarRead" -> calendarRead(args)
              "calendarWrite" -> calendarWrite(args)
              else -> throw IllegalArgumentException("Неизвестное действие Android")
            }
            resolve(invoke,result)
          } catch(error:Exception) {invoke.reject(if(operation=="credential")"Не удалось открыть защищённое хранилище Android" else error.message ?: "Действие Android недоступно")}
        }.start()
      }
    } catch(error:Exception) {invoke.reject(error.message ?: "Действие Android недоступно")}
  }
  private fun notificationStatus():String {
    if(Build.VERSION.SDK_INT>=33 && !allowed(Manifest.permission.POST_NOTIFICATIONS))return "Разрешите уведомления Orvim в настройках Android."
    val alarm=activity.getSystemService(AlarmManager::class.java)
    return if(Build.VERSION.SDK_INT>=31 && !alarm.canScheduleExactAlarms()) "Напоминания включены. Для точного времени разрешите Orvim «Будильники и напоминания» в настройках Android." else "Напоминания включены."
  }
  private fun healthUnavailable() = JSONObject().put("status","unsupported").put("granted",JSONArray()).put("message","Для Health Connect нужен Android 9 или новее с Google Play Services. Ручные записи доступны.")
  @ActivityCallback fun healthPermissionResult(invoke:Invoke,result:ActivityResult) {
    Thread { try { resolve(invoke,health.status()) } catch(error:Exception) { invoke.reject(error.message ?: "Не удалось прочитать разрешения Health Connect") } }.start()
  }
  @PermissionCallback fun notificationPermissionResult(invoke:Invoke) {resolve(invoke,JSONObject().put("message",notificationStatus()))}
  @ActivityCallback fun backupFolderResult(invoke:Invoke,result:ActivityResult) {try{resolve(invoke,if(result.resultCode==Activity.RESULT_OK)backups.select(result.data)else backups.status())}catch(error:Exception){invoke.reject(error.message ?: "Не удалось выбрать папку")}}
  @PermissionCallback fun calendarPermissionResult(invoke:Invoke) {if(allowed(Manifest.permission.READ_CALENDAR)&&allowed(Manifest.permission.WRITE_CALENDAR))resolve(invoke,JSONObject().put("granted",true))else invoke.reject("Разрешите доступ к календарю в настройках Android")}
  @PermissionCallback fun microphoneResult(invoke:Invoke) {
    if(!allowed(Manifest.permission.RECORD_AUDIO)){invoke.reject("Разрешите микрофон в настройках Android");return}
    val args=JSONObject(invoke.getRawArgs()).optJSONObject("payload") ?: JSONObject()
    activity.runOnUiThread {try{resolve(invoke,dictation.start(args))}catch(error:Exception){invoke.reject(error.message ?: "Микрофон недоступен")}}
  }
  @ActivityCallback fun speechResult(invoke:Invoke,result:ActivityResult) {resolve(invoke,JSONObject().put("text",if(result.resultCode==Activity.RESULT_OK)result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() ?: "" else ""))}
  @ActivityCallback fun pairingScanResult(invoke:Invoke,result:ActivityResult) {
    if(result.data?.getBooleanExtra(Intents.Scan.MISSING_CAMERA_PERMISSION,false)==true){invoke.reject("Разрешите камеру Orvim в настройках Android или введите код вручную.");return}
    val link=ScanContract().parseResult(result.resultCode,result.data).contents
    if(link==null){resolve(invoke,JSONObject().put("cancelled",true));return}
    if(link.length>2048){invoke.reject("Это не QR-код подключения Orvim.");return}
    resolve(invoke,JSONObject().put("link",link))
  }
  override fun onNewIntent(intent:Intent) {
    OrvimWidgets.takeAction(activity,intent)?.let { action ->
      if(widgetReady && webView!=null) webView?.post { webView?.evaluateJavascript("window.dispatchEvent(new CustomEvent('orvim:widget-action',{detail:${action}}))",null) }
      else pendingWidgetAction=action
    }
    if(intent.data?.scheme in listOf("lifeos","orvim") && intent.data?.host=="pair"){
      val link=intent.dataString ?: "";intent.data=null
      if(pairingReady && webView!=null) webView?.post {webView?.evaluateJavascript("window.dispatchEvent(new CustomEvent('life-os:pairing-link',{detail:{link:${JSONObject.quote(link)}}}))",null)}
      else pendingPairingLink=link
    }
    val kind=intent.getStringExtra("lifeKind") ?: return
    intent.removeExtra("lifeKind")
    webView?.post {webView?.evaluateJavascript("window.dispatchEvent(new CustomEvent('life-os:notification',{detail:{kind:${JSONObject.quote(kind)}}}))",null)}
  }
  private fun credential(args:JSONObject):JSONObject {
    val preferences=activity.getSharedPreferences("life_credentials",Context.MODE_PRIVATE)
    val provider=args.getString("provider")
    require(provider in listOf("openai","deepseek","gemini","notion","json","google","google-refresh","google-client","lan-peer","lan-host","webdav","storage-key"))
    val store=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
    val alias="life-os-connections"
    if(!store.containsAlias(alias))KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply {init(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generateKey()}
    val key=store.getKey(alias,null) as SecretKey
    when(args.getString("mode")) {
      "delete" -> {check(preferences.edit().remove(provider).commit());return JSONObject()}
      "set" -> {
        val cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key)
        val bytes=cipher.doFinal(args.getString("value").toByteArray(Charsets.UTF_8))
        val encoded=Base64.encodeToString(cipher.iv,Base64.NO_WRAP)+":"+Base64.encodeToString(bytes,Base64.NO_WRAP)
        check(preferences.edit().putString(provider,encoded).commit());return JSONObject()
      }
      "get" -> {
        val encoded=preferences.getString(provider,null) ?: return JSONObject()
        val parts=encoded.split(":");val cipher=Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE,key,GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)))
        return JSONObject().put("value",String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),Charsets.UTF_8))
      }
      else -> throw IllegalArgumentException("Неизвестное действие хранилища")
    }
  }
  private fun requireCalendar(write:Boolean=false) {check(allowed(if(write)Manifest.permission.WRITE_CALENDAR else Manifest.permission.READ_CALENDAR)){"Разрешите доступ к календарям Android"}}
  @Suppress("DEPRECATION")
  private fun installPackage(args:JSONObject):JSONObject {
    check(!args.optBoolean("rollback")){"Android блокирует установку более старой версии. Сначала создайте внешнюю копию, затем удалите приложение и установите предыдущий подписанный APK. После установки восстановите совместимую копию."}
    val file=java.io.File(args.getString("path")).canonicalFile
    val root=java.io.File(activity.filesDir,"updates").canonicalFile
    require(file.parentFile==root && file.name.startsWith("lifeos-")&&file.extension=="apk"&&file.isFile){"Некорректный пакет обновления"}
    val flags=if(Build.VERSION.SDK_INT>=28)PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
    val archive=activity.packageManager.getPackageArchiveInfo(file.path,flags) ?: error("APK повреждён")
    val current=activity.packageManager.getPackageInfo(activity.packageName,flags)
    require(archive.packageName==activity.packageName){"APK относится к другому приложению"}
    fun signatures(info:android.content.pm.PackageInfo)=if(Build.VERSION.SDK_INT>=28)info.signingInfo?.apkContentsSigners?.map{it.toCharsString()}?.sorted()else info.signatures?.map{it.toCharsString()}?.sorted()
    require(signatures(archive)!=null && signatures(archive)==signatures(current)){"Подпись APK отличается от установленной версии. Обновление запрещено"}
    if(Build.VERSION.SDK_INT>=26 && !activity.packageManager.canRequestPackageInstalls()){
      activity.startActivity(Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.packageName)))
      return JSONObject().put("permissionRequired",true)
    }
    val uri=androidx.core.content.FileProvider.getUriForFile(activity,activity.packageName+".fileprovider",file)
    activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
    return JSONObject().put("installerOpened",true)
  }
  private fun calendarList():JSONObject {
    requireCalendar();val items=JSONArray()
    activity.contentResolver.query(CalendarContract.Calendars.CONTENT_URI,arrayOf("_id","calendar_displayName","account_name","calendar_access_level"),null,null,null)?.use{cursor->
      while(cursor.moveToNext()){items.put(JSONObject().put("id",cursor.getLong(0).toString()).put("summary",cursor.getString(1)+" · "+cursor.getString(2)).put("writable",cursor.getInt(3)>=500))}
    };return JSONObject().put("items",items)
  }
  private fun millis(date:String,time:String="00:00") = LocalDateTime.parse(date+"T"+time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
  private fun iso(at:Long) = Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).toOffsetDateTime().toString()
  private fun etag(title:String?,description:String?,start:Long,end:Long) = java.security.MessageDigest.getInstance("SHA-256").digest(listOf(title ?: "",description ?: "",start,end).joinToString("\u001f").toByteArray(Charsets.UTF_8)).joinToString(""){"%02x".format(it)}
  private fun calendarRead(args:JSONObject):JSONObject {
    requireCalendar();val id=args.getString("calendarId").toLong();val from=millis(args.getString("from"));val until=millis(LocalDate.parse(args.getString("until")).plusDays(1).toString());require(until>from)
    val builder=CalendarContract.Instances.CONTENT_URI.buildUpon();ContentUris.appendId(builder,from);ContentUris.appendId(builder,until)
    val items=JSONArray()
    activity.contentResolver.query(builder.build(),arrayOf("event_id","title","description","begin","end","allDay","rrule"),"calendar_id=?",arrayOf(id.toString()),"begin ASC")?.use{cursor->
      while(cursor.moveToNext()) {
        check(items.length()<10000){"Выберите меньший период: больше 10 000 событий"}
        val title=cursor.getString(1);val description=cursor.getString(2);val start=cursor.getLong(3);val end=cursor.getLong(4);val allDay=cursor.getInt(5)==1
        val startValue=JSONObject().put(if(allDay)"date" else "dateTime",if(allDay)Instant.ofEpochMilli(start).atZone(ZoneOffset.UTC).toLocalDate().toString() else iso(start))
        val endValue=JSONObject().put(if(allDay)"date" else "dateTime",if(allDay)Instant.ofEpochMilli(end).atZone(ZoneOffset.UTC).toLocalDate().toString() else iso(end))
        items.put(JSONObject().put("id",cursor.getLong(0).toString()+if(!cursor.getString(6).isNullOrEmpty())"@"+start else "").put("eventId",cursor.getLong(0).toString()).put("summary",title ?: "Без названия").put("description",description ?: "").put("start",startValue).put("end",endValue).put("etag",etag(title,description,start,end)))
      }
    };return JSONObject().put("items",items)
  }
  private fun calendarWrite(args:JSONObject):JSONObject {
    requireCalendar(true);requireCalendar();val calendarId=args.getString("calendarId").toLong();val items=args.getJSONArray("items");require(items.length()<=1000);val saved=JSONArray();val errors=JSONArray()
    for(index in 0 until items.length()) {
      val item=items.getJSONObject(index)
      try {
        val allDay=!item.has("start");val date=LocalDate.parse(item.getString("date"));val start=if(allDay)date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() else millis(item.getString("date"),item.getString("start"));val end=if(allDay)(item.optString("calendarEndDate").takeIf{it>date.toString()}?.let{LocalDate.parse(it)} ?: date.plusDays(1)).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli() else millis(item.getString("date"),item.getString("end"));require(end>start)
        val title=item.getString("title");val description=item.optString("description","")
        val values=ContentValues().apply{put(CalendarContract.Events.CALENDAR_ID,calendarId);put(CalendarContract.Events.TITLE,title);put(CalendarContract.Events.DESCRIPTION,description);put(CalendarContract.Events.DTSTART,start);put(CalendarContract.Events.DTEND,end);put(CalendarContract.Events.EVENT_TIMEZONE,if(allDay)"UTC" else ZoneId.systemDefault().id);put(CalendarContract.Events.ALL_DAY,if(allDay)1 else 0)}
        val source=item.optJSONObject("source");val existing=source?.optString("eventId")?.takeIf{it.isNotEmpty()} ?: source?.optString("id")?.substringBefore('@')
        val id=if(!existing.isNullOrEmpty()) {
          val uri=ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,existing.toLong())
          activity.contentResolver.query(uri,arrayOf("calendar_id","title","description","dtstart","dtend","rrule"),null,null,null)?.use{cursor->
            check(cursor.moveToFirst()&&cursor.getLong(0)==calendarId){"Событие удалено или принадлежит другому календарю"}
            check(cursor.getString(5).isNullOrEmpty()){ "Повторяющееся событие изменяйте в системном календаре, чтобы сохранить серию" }
            check(source?.optString("etag")==etag(cursor.getString(1),cursor.getString(2),cursor.getLong(3),cursor.getLong(4))){"Событие изменилось в другом приложении: получите его заново"}
          } ?: error("Событие не найдено")
          check(activity.contentResolver.update(uri,values,null,null)==1);existing
        } else {ContentUris.parseId(activity.contentResolver.insert(CalendarContract.Events.CONTENT_URI,values) ?: error("Не удалось создать событие")).toString()}
        saved.put(JSONObject().put("localId",item.getLong("id")).put("id",id).put("etag",etag(title,description,start,end)))
      }catch(error:Exception){errors.put(item.optString("title")+": "+error.message)}
    };
    val deleted=JSONArray();val deletions=args.optJSONArray("deletions") ?: JSONArray();require(deletions.length()<=1000)
    for(index in 0 until deletions.length()){val row=deletions.getJSONObject(index);val source=row.getJSONObject("source");val id=source.getString("id").substringBefore('@');try{val uri=ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,id.toLong());var found=false;activity.contentResolver.query(uri,arrayOf("calendar_id","title","description","dtstart","dtend","rrule"),null,null,null)?.use{cursor->if(cursor.moveToFirst()){found=true;check(cursor.getLong(0)==calendarId);check(cursor.getString(5).isNullOrEmpty()){ "Повторяющуюся серию удаляйте в системном календаре" };check(source.optString("etag")==etag(cursor.getString(1),cursor.getString(2),cursor.getLong(3),cursor.getLong(4))){"Событие изменилось в другом приложении"}}};if(found)activity.contentResolver.delete(uri,null,null);deleted.put(source.getString("id"))}catch(error:Exception){errors.put(row.optString("title")+": "+error.message)}}
    return JSONObject().put("saved",saved).put("errors",errors).put("deleted",deleted)
  }
}

object LifeAlarms {
  private const val preferencesName="life_reminders"
  @Volatile private var foreground=false
  @Synchronized fun enterForeground(context:Context) {
    foreground=true
    val manager=context.getSystemService(NotificationManager::class.java)
    for(notification in manager.activeNotifications) {
      if(notification.tag=="life-wellbeing"||notification.tag=="life-event")manager.cancel(notification.tag,notification.id)
    }
  }
  @Synchronized fun leaveForeground() {foreground=false}
  private fun pending(context:Context,id:String,item:JSONObject):PendingIntent {
    val intent=Intent(context,LifeReminderReceiver::class.java).setAction("local.lifeos.REMINDER").setData(Uri.parse("lifeos://reminder/"+Uri.encode(id))).putExtra("item",item.toString())
    return PendingIntent.getBroadcast(context,0,intent,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
  @Synchronized fun update(context:Context,plan:JSONObject) {
    val checkedIn=plan.optLong("lastCheckinAt",0L)>(currentPlan(context)?.optLong("lastCheckinAt",0L) ?: 0L)
    val prefs=context.getSharedPreferences(preferencesName,Context.MODE_PRIVATE);check(prefs.edit().putString("protected-plan",protectPlan(plan.toString())).remove("plan").commit());schedule(context,plan)
    val manager=context.getSystemService(NotificationManager::class.java)
    for(notification in manager.activeNotifications) {
      val kind=when(notification.tag){"life-wellbeing"->"wellbeing";"life-event"->"event";else->null}
      if(kind!=null&&(foreground||!allows(plan,kind)||(kind=="wellbeing"&&checkedIn)))manager.cancel(notification.tag,notification.id)
    }
  }
  private fun planKey():SecretKey {
    val store=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
    val alias="orvim-reminders"
    if(!store.containsAlias(alias))KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply{init(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generateKey()}
    return store.getKey(alias,null) as SecretKey
  }
  private fun protectPlan(value:String):String {
    val cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,planKey())
    return Base64.encodeToString(cipher.iv,Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.toByteArray(Charsets.UTF_8)),Base64.NO_WRAP)
  }
  private fun currentPlan(context:Context):JSONObject? {
    val prefs=context.getSharedPreferences(preferencesName,Context.MODE_PRIVATE)
    val encoded=prefs.getString("protected-plan",null)
    if(encoded!=null) return try {
      val parts=encoded.split(":");val cipher=Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE,planKey(),GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)))
      JSONObject(String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),Charsets.UTF_8))
    }catch(error:Exception){null}
    val legacy=prefs.getString("plan",null) ?: return null
    val plan=JSONObject(legacy)
    check(prefs.edit().putString("protected-plan",protectPlan(legacy)).remove("plan").commit())
    return plan
  }
  private fun wellbeingSlots(plan:JSONObject):List<Pair<Int,Int>> {
    val slots=plan.optJSONArray("wellbeingSlots") ?: return listOf(9 to 0,15 to 12,21 to 18)
    val valid=(0 until slots.length()).mapNotNull { i ->
      val slot=slots.optJSONObject(i) ?: return@mapNotNull null
      val hour=slot.optInt("hour",-1);val start=slot.optInt("start",-1)
      if(hour in 0..23 && start in 0..hour) hour to start else null
    }
    return if(valid.size in 1..6) valid else listOf(9 to 0,15 to 12,21 to 18)
  }
  private fun allows(plan:JSONObject,kind:String):Boolean = plan.optBoolean("enabled",true)&&when(kind){"wellbeing"->plan.optBoolean("wellbeingEnabled",true);"event"->plan.optBoolean("scheduleEnabled",true);else->false}
  @Synchronized fun refresh(context:Context) {val plan=currentPlan(context) ?: return;schedule(context,plan)}
  @Synchronized fun deliver(context:Context,item:JSONObject) {
    // Check the latest switches at delivery time, including already queued alarms.
    val plan=currentPlan(context) ?: return
    if(foreground)return
    val kind=item.optString("kind")
    if(!allows(plan,kind))return
    // An alarm may already be in flight when a check-in or event edit is saved.
    if(kind=="wellbeing") {
      val local=java.time.Instant.ofEpochMilli(item.optLong("at",0L)).atZone(ZoneId.systemDefault())
      if(local.minute!=0 || local.second!=0 || local.hour !in wellbeingSlots(plan).map { it.first })return
    }
    if(kind=="wellbeing"&&item.optLong("at",0L)<plan.optLong("wellbeingAt",0L))return
    if(kind=="event") {
      val items=plan.optJSONArray("items") ?: return
      val current=(0 until items.length()).map{items.getJSONObject(it)}.firstOrNull{it.optString("id")==item.optString("id")} ?: return
      val expected=LocalDateTime.parse(current.getString("date")+"T"+current.getString("start")).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()-300000L
      if(item.optLong("at",0L)!=expected)return
      item.put("title",current.optString("title"))
    }
    if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(context,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return
    val wellbeing=kind=="wellbeing"
    val soundEnabled=plan.optBoolean("soundEnabled",true)
    val sound=if(soundEnabled)Uri.parse("android.resource://${context.packageName}/raw/"+if(wellbeing)"life_wellbeing_compact" else "life_schedule_warm") else null
    val russian=plan.optString("language").startsWith("ru")
    val manager=context.getSystemService(NotificationManager::class.java)
    // Channels retain their first sound; use distinct audible and silent channels.
    val channelId="life-"+(if(wellbeing)"wellbeing-compact" else "schedule-warm")+(if(soundEnabled)"-v1" else "-silent-v1")
    if(Build.VERSION.SDK_INT>=26) {
      val name=(if(wellbeing){if(russian)"Самочувствие" else "Wellbeing"}else{if(russian)"Расписание" else "Schedule"})+(if(soundEnabled)"" else if(russian)" · без звука" else " · silent")
      val attributes=AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
      manager.createNotificationChannel(NotificationChannel(channelId,name,NotificationManager.IMPORTANCE_DEFAULT).apply{setSound(sound,attributes);enableVibration(false)})
    }
    val click=Intent(context,MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("lifeKind",kind)
    val pi=PendingIntent.getActivity(context,item.optString("id").hashCode(),click,PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val builder=if(Build.VERSION.SDK_INT>=26)Notification.Builder(context,channelId)else Notification.Builder(context)
    if(Build.VERSION.SDK_INT<26)builder.setSound(sound)
    val body=if(wellbeing){if(russian)"Время отметить самочувствие" else "Time for a wellbeing check-in"}else{if(russian)"Начало через 5 минут" else "Starts in 5 minutes"}
    val notification=builder.setSmallIcon(R.drawable.ic_notification).setContentTitle(item.optString("title")).setContentText(body).setContentIntent(pi).setAutoCancel(true).build()
    manager.notify("life-"+kind,item.optString("id").hashCode(),notification)
  }
  private fun schedule(context:Context,plan:JSONObject) {
    val prefs=context.getSharedPreferences(preferencesName,Context.MODE_PRIVATE);val alarm=context.getSystemService(AlarmManager::class.java)
    for(id in prefs.getStringSet("ids",emptySet()) ?: emptySet())alarm.cancel(pending(context,id,JSONObject()))
    val ids=mutableSetOf<String>();val now=System.currentTimeMillis()
    fun add(item:JSONObject) {val id=item.getString("id");val at=item.getLong("at");val pi=pending(context,id,item)
      if(Build.VERSION.SDK_INT<31 || alarm.canScheduleExactAlarms())alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi)else alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,pi);ids.add(id)
    }
    if(plan.optBoolean("enabled",true)) {
      val rows=if(plan.optBoolean("scheduleEnabled",true))plan.optJSONArray("items") ?: JSONArray() else JSONArray()
      val items=(0 until rows.length()).map{rows.getJSONObject(it)}.map{item->
        val at=LocalDateTime.parse(item.getString("date")+"T"+item.getString("start")).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()-300000L;item.put("at",at)
      }.filter{it.getLong("at")>now}.sortedBy{it.getLong("at")}.take(450)
      items.forEach{add(it)}
      if(plan.optBoolean("wellbeingEnabled",true)) {
        val zone=ZoneId.systemDefault();val localNow=java.time.Instant.ofEpochMilli(now).atZone(zone)
        val last=plan.optLong("lastCheckinAt",0L)
        val at=(0L..2L).flatMap { offset ->
          val date=localNow.toLocalDate().plusDays(offset)
          wellbeingSlots(plan).map { (hour,start) ->
            val candidate=date.atTime(hour,0).atZone(zone).toInstant().toEpochMilli()
            val period=date.atTime(start,0).atZone(zone).toInstant().toEpochMilli()
            candidate to period
          }
        }.first { (candidate,period) -> candidate>now && !(last>=period && last<=now) }.first
        add(JSONObject().put("id","wellbeing").put("kind","wellbeing").put("at",at).put("title",if(plan.optString("language").startsWith("ru"))"Как вы сейчас?" else "How are you feeling?"))
      }
    }
    check(prefs.edit().putStringSet("ids",ids).commit())
  }
}
class LifeReminderReceiver:BroadcastReceiver() {
  override fun onReceive(context:Context,intent:Intent) {
    val pending=goAsync()
    Thread {
      try {
        if(intent.action=="local.lifeos.REMINDER") {
          LifeAlarms.deliver(context,JSONObject(intent.getStringExtra("item") ?: "{}"))
        }
        LifeAlarms.refresh(context)
      } catch (_:Exception) { /* Retain the persisted plan for the next app launch. */ }
      finally {pending.finish()}
    }.start()
  }
}
