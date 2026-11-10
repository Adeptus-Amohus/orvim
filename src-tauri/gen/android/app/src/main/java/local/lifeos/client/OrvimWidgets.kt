package local.lifeos.client

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.*
import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.text.TextUtils
import android.util.Base64
import android.view.View
import android.widget.RemoteViews
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import kotlin.math.*

/** Minimal, encrypted launcher projection. No credentials, conversation or full DB. */
object OrvimWidgets {
  private const val STORE="orvim_widgets"
  private const val EXTRA="orvimWidgetAction"
  private const val TOKEN="orvimWidgetToken"
  private val providers=listOf(OrvimDayWidget::class.java,OrvimFoodWidget::class.java,OrvimThoughtWidget::class.java)
  private fun preferences(context:Context)=context.getSharedPreferences(STORE,Context.MODE_PRIVATE)
  @Synchronized private fun key():SecretKey {
    val store=KeyStore.getInstance("AndroidKeyStore").apply{load(null)}
    val alias="orvim-widget-cache"
    if(!store.containsAlias(alias))KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());generateKey()
    }
    return store.getKey(alias,null) as SecretKey
  }
  fun save(context:Context, data:JSONObject) {
    synchronized(this) {
    val bytes=data.toString().toByteArray(Charsets.UTF_8)
    require(bytes.size<=2_000_000 && data.optInt("version")==1){"Некорректные данные виджета"}
    val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.ENCRYPT_MODE,key())}
    val encoded=Base64.encodeToString(cipher.iv,Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(bytes),Base64.NO_WRAP)
    check(preferences(context).edit().putString("projection",encoded).putString("language",data.optString("language","ru"))
      .putString("appearance",data.optString("appearance","system")).putString("palette",data.optString("palette","sun"))
      .putString("customColor",data.optString("customColor","#8c6ad8")).commit())
    }
    refresh(context)
  }
  private fun stored(context:Context):JSONObject = try {
    val encoded=preferences(context).getString("projection",null)
    if(encoded==null) JSONObject() else {
      val parts=encoded.split(":")
      val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)))}
      JSONObject(String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),Charsets.UTF_8))
    }
  } catch(_:Exception) {JSONObject()}
  @Synchronized private fun writeJournal(context:Context,rows:JSONArray) {
    val raw=rows.toString().toByteArray(Charsets.UTF_8)
    require(rows.length()<=500 && raw.size<=1_000_000){"Слишком много записей: откройте Orvim для переноса в базу."}
    val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.ENCRYPT_MODE,key())}
    val value=Base64.encodeToString(cipher.iv,Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(raw),Base64.NO_WRAP)
    check(preferences(context).edit().putString("journal",value).commit()){"Не удалось сохранить запись"}
  }
  @Synchronized fun pending(context:Context):JSONArray {
    val value=preferences(context).getString("journal",null) ?: return JSONArray()
    val parts=value.split(":")
    val cipher=Cipher.getInstance("AES/GCM/NoPadding").apply{init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)))}
    return JSONArray(String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),Charsets.UTF_8))
  }
  fun enqueue(context:Context,rows:List<JSONObject>) {
    synchronized(this) {
    val journal=pending(context)
    for(row in rows){row.put("key",UUID.randomUUID().toString());if(!row.has("at"))row.put("at",System.currentTimeMillis());journal.put(row)}
    writeJournal(context,journal)
    }
    try{refresh(context)}catch(_:Exception){}
  }
  fun ack(context:Context,keys:JSONArray) {
    synchronized(this) {
    val selected=(0 until keys.length()).map{keys.optString(it)}.toSet()
    val old=pending(context);val remaining=JSONArray()
    for(i in 0 until old.length()){val row=old.getJSONObject(i);if(row.optString("key") !in selected)remaining.put(row)}
    writeJournal(context,remaining)
    }
    refresh(context)
  }
  fun clear(context:Context) {
    synchronized(this) {
    check(preferences(context).edit().remove("projection").remove("journal").commit())
    }
    try{refresh(context)}catch(_:Exception){}
  }
  fun read(context:Context):JSONObject {
    val data=stored(context)
    val days=data.optJSONArray("days") ?: JSONArray().also{data.put("days",it)}
    val applied=data.optJSONArray("appliedOperations") ?: JSONArray()
    val receipts=(0 until applied.length()).map{applied.optString(it)}.toSet()
    val journal=try{pending(context)}catch(_:Exception){JSONArray()}
    for(i in 0 until journal.length()){
      val op=journal.getJSONObject(i)
      if(op.optString("key") in receipts)continue
      val date=op.optString("date",LocalDate.now().toString())
      val entry=day(data,date) ?: JSONObject().put("date",date).put("items",JSONArray()).put("total",0).put("calories",0).put("foodTarget",0).also{days.put(it)}
      val items=entry.getJSONArray("items")
      when(op.optString("action")){
        "edit" -> for(d in 0 until days.length()){
          val source=days.getJSONObject(d);val sourceItems=source.optJSONArray("items") ?: continue
          for(j in sourceItems.length()-1 downTo 0){val item=sourceItems.getJSONObject(j)
            if((op.has("targetOperation") && item.optString("operation")==op.optString("targetOperation")) || (!op.has("targetOperation") && item.optLong("id")==op.optLong("id") && item.optString("kind")==op.optString("kind"))){
              item.put("title",op.getString("text")).put("start",op.getString("time")).put("duration",op.getInt("duration"))
              item.put("end",java.time.LocalTime.parse(op.getString("time")).plusMinutes(op.getLong("duration")).toString())
              if(source!==entry){sourceItems.remove(j);items.put(item);source.put("total",maxOf(0,source.optInt("total")-1));entry.put("total",entry.optInt("total")+1)}
            }
          }
        }
        "task" -> {items.put(JSONObject().put("id",-1L-i).put("operation",op.getString("key")).put("kind","task").put("title",op.optString("text")).put("start",op.optString("time")).put("done",false));entry.put("total",entry.optInt("total")+1)}
        "food" -> entry.put("calories",entry.optDouble("calories")+op.optDouble("calories"))
        "complete" -> for(j in 0 until items.length()){val item=items.getJSONObject(j);if((op.has("targetOperation") && item.optString("operation")==op.optString("targetOperation")) || (!op.has("targetOperation") && item.optLong("id")==op.optLong("id") && item.optString("kind")==op.optString("kind")))item.put("done",op.optBoolean("done"))}
      }
    }
    return data
  }
  @Synchronized private fun token(context:Context):String {
    val prefs=preferences(context)
    return prefs.getString("intent-token",null) ?: UUID.randomUUID().toString().also{check(prefs.edit().putString("intent-token",it).commit())}
  }
  fun takeAction(context:Context,intent:Intent?):JSONObject? {
    if(intent==null)return null
    val raw=intent.getStringExtra(EXTRA) ?: return null
    val supplied=intent.getStringExtra(TOKEN)
    intent.removeExtra(EXTRA);intent.removeExtra(TOKEN)
    if(supplied!=token(context) || raw.length>1000)return null
    return try {JSONObject(raw).takeIf{it.optString("action") in listOf("home","task","thought","food","item","complete","rows")}}catch(_:Exception){null}
  }
  fun launch(context:Context,widgetId:Int,action:String,item:JSONObject?=null):PendingIntent {
    val payload=JSONObject().put("action",action)
    if(item!=null)payload.put("id",item.optLong("id")).put("kind",item.optString("kind")).put("done",!item.optBoolean("done"))
    if(item?.has("operation")==true)payload.put("targetOperation",item.optString("operation"))
    val identity="$widgetId/$action/${item?.optString("kind") ?: ""}/${item?.optLong("id") ?: 0}"
    val background=action in listOf("home","complete","rows")
    val intent=Intent(context,if(background)OrvimWidgetActionReceiver::class.java else OrvimWidgetCaptureActivity::class.java).setAction("local.lifeos.client.WIDGET/$identity")
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      .putExtra("widgetId",widgetId)
      .putExtra(EXTRA,payload.toString()).putExtra(TOKEN,token(context))
    val flags=PendingIntent.FLAG_UPDATE_CURRENT or (if(action in listOf("rows","item")) PendingIntent.FLAG_MUTABLE else PendingIntent.FLAG_IMMUTABLE)
    return if(background)PendingIntent.getBroadcast(context,identity.hashCode(),intent,flags)else PendingIntent.getActivity(context,identity.hashCode(),intent,flags)
  }
  fun refresh(context:Context) {
    val manager=AppWidgetManager.getInstance(context)
    for(provider in providers)for(id in manager.getAppWidgetIds(ComponentName(context,provider)))render(context,manager,id,provider)
    val dayIds=manager.getAppWidgetIds(ComponentName(context,OrvimDayWidget::class.java))
    if(android.os.Build.VERSION.SDK_INT<31){
      manager.notifyAppWidgetViewDataChanged(dayIds,R.id.widget_timeline_list)
      manager.notifyAppWidgetViewDataChanged(dayIds,R.id.widget_task_list)
    }
  }
  fun day(data:JSONObject,date:String):JSONObject? {
    val days=data.optJSONArray("days") ?: return null
    for(i in 0 until days.length()){val row=days.optJSONObject(i);if(row?.optString("date")==date)return row}
    return null
  }
  fun rows(day:JSONObject?):List<JSONObject> {
    val items=day?.optJSONArray("items") ?: JSONArray()
    return (0 until items.length()).mapNotNull{items.optJSONObject(it)}
  }
  private fun colors(context:Context)=OrvimWidgetTheme.load(context)
  fun render(context:Context,manager:AppWidgetManager,id:Int,provider:Class<out AppWidgetProvider>) {
    if(provider==OrvimThoughtWidget::class.java){
      val english=preferences(context).getString("language",Locale.getDefault().language)=="en"
      val thought=RemoteViews(context.packageName,R.layout.widget_thought)
      thought.setTextViewText(R.id.widget_title,if(english)"Write a thought" else "Записать мысль")
      val theme=colors(context)
      theme.background(thought,R.id.widget_thought_pill,"thought")
      thought.setTextColor(R.id.widget_title,theme.ink)
      thought.setOnClickPendingIntent(R.id.widget_thought_pill,launch(context,id,"thought"))
      manager.updateAppWidget(id,thought)
      return
    }
    val data=read(context)
    val en=data.optString("language").let{if(it.isEmpty())Locale.getDefault().language=="en" else it=="en"}
    fun t(ru:String,english:String)=if(en)english else ru
    val today=LocalDate.now()
    val current=day(data,today.toString())
    val c=colors(context)
    val layout=when(provider){OrvimFoodWidget::class.java->R.layout.widget_food;OrvimThoughtWidget::class.java->R.layout.widget_thought;else->R.layout.widget_day}
    val views=RemoteViews(context.packageName,layout)
    c.background(views,R.id.widget_root,"surface")
    views.setTextColor(R.id.widget_title,c.ink)
    if(provider==OrvimThoughtWidget::class.java){
      views.setTextViewText(R.id.widget_title,t("Записать мысль","Write a thought"))
      views.setOnClickPendingIntent(R.id.widget_thought_pill,launch(context,id,"thought"))
    }else if(provider==OrvimFoodWidget::class.java){
      views.setTextColor(R.id.widget_calories,c.ink)
      views.setTextColor(R.id.widget_calorie_goal,c.muted)
      views.setImageViewBitmap(R.id.widget_add_food,plus(c.accentText))
      views.setContentDescription(R.id.widget_calorie_bar,t("Прогресс калорий","Calorie progress"))
      val personalDate=LocalDateTime.now().minusMinutes(data.optLong("dayStartMinutes")).toLocalDate()
      val nutrition=day(data,personalDate.toString())
      val calories=nutrition?.optInt("calories") ?: 0
      val goal=nutrition?.optInt("foodTarget") ?: 0
      views.setTextViewText(R.id.widget_title,t("Питание","Nutrition"))
      views.setTextViewText(R.id.widget_calories,if(nutrition==null)"—" else String.format(if(en)Locale.US else Locale.forLanguageTag("ru"),"%,d",calories))
      views.setTextViewText(R.id.widget_calorie_goal,if(nutrition==null)t("Откройте Orvim","Open Orvim")else if(goal>0)t("из $goal ккал","of $goal kcal")else t("ккал за мой день","kcal this day"))
      views.setViewVisibility(R.id.widget_calorie_bar,if(goal>0)View.VISIBLE else View.GONE)
      views.setImageViewBitmap(R.id.widget_calorie_bar,bar(c,if(goal>0)calories.toFloat()/goal else 0f))
      c.background(views,R.id.widget_add_food,"soft")
      views.setContentDescription(R.id.widget_add_food,t("Записать еду","Log food"))
      views.setOnClickPendingIntent(R.id.widget_root,launch(context,id,"food"))
      views.setOnClickPendingIntent(R.id.widget_add_food,launch(context,id,"food"))
    }else{
      for(viewId in listOf(R.id.widget_date,R.id.widget_empty))views.setTextColor(viewId,c.muted)
      views.setTextColor(R.id.widget_tasks_title,c.ink)
      for(viewId in listOf(R.id.widget_now,R.id.widget_add_task,R.id.widget_add_thought)){
        c.background(views,viewId,"soft");views.setTextColor(viewId,c.accentText)
      }
      val items=rows(current)
      val locale=if(en)Locale.ENGLISH else Locale.forLanguageTag("ru")
      views.setTextViewText(R.id.widget_title,t("Расписание","Schedule"))
      views.setContentDescription(R.id.widget_timeline_list,t("Расписание по часам","Hourly schedule"))
      views.setTextViewText(R.id.widget_date,today.format(DateTimeFormatter.ofPattern("d MMM",locale)))
      views.setTextViewText(R.id.widget_now,t("Сейчас","Now"))
      views.setOnClickPendingIntent(R.id.widget_now,launch(context,id,"home"))
      for((viewId,section) in listOf(R.id.widget_timeline_list to "hours",R.id.widget_task_list to "tasks")){
        val service=Intent(context,OrvimWidgetListService::class.java).putExtra("widgetId",id).putExtra("section",section).setData(Uri.parse("orvim-widget://list/$id/$section"))
        if(android.os.Build.VERSION.SDK_INT>=31){
          val factory=OrvimWidgetListService.Factory(context,section)
          factory.onDataSetChanged()
          val collection=RemoteViews.RemoteCollectionItems.Builder().setViewTypeCount(1).setHasStableIds(false)
          for(position in 0 until factory.count)collection.addItem(position.toLong(),factory.getViewAt(position))
          views.setRemoteAdapter(viewId,collection.build())
        }else views.setRemoteAdapter(viewId,service)
      }
      views.setPendingIntentTemplate(R.id.widget_task_list,launch(context,id,"rows"))
      views.setPendingIntentTemplate(R.id.widget_timeline_list,launch(context,id,"item"))
      if(preferences(context).getString("scroll-date-$id",null)!=today.toString()){
        views.setScrollPosition(R.id.widget_timeline_list,(LocalDateTime.now().hour+1).coerceIn(0,23))
        preferences(context).edit().putString("scroll-date-$id",today.toString()).apply()
      }
      val tasks=items.sortedBy{it.optBoolean("done")}
      views.setTextViewText(R.id.widget_tasks_title,t("Задачи","Tasks")+" · "+(current?.optInt("total") ?: 0))
      views.setViewVisibility(R.id.widget_empty,if(tasks.isEmpty())View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.widget_empty,t("На эту дату задач нет","No tasks for this day"))
      views.setTextViewText(R.id.widget_add_task,t("+ Задача","+ Task"));views.setTextViewText(R.id.widget_add_thought,t("+ Мысль","+ Thought"))
      views.setOnClickPendingIntent(R.id.widget_add_task,launch(context,id,"task"));views.setOnClickPendingIntent(R.id.widget_add_thought,launch(context,id,"thought"))
    }
    manager.updateAppWidget(id,views)
  }
  private fun plus(color:Int):Bitmap {
    val bitmap=Bitmap.createBitmap(96,96,Bitmap.Config.ARGB_8888)
    val paint=Paint(Paint.ANTI_ALIAS_FLAG).apply{this.color=color;strokeWidth=8f;strokeCap=Paint.Cap.ROUND}
    Canvas(bitmap).apply{drawLine(48f,20f,48f,76f,paint);drawLine(20f,48f,76f,48f,paint)}
    return bitmap
  }
  private fun bar(c:OrvimWidgetTheme,value:Float):Bitmap {
    val b=Bitmap.createBitmap(300,12,Bitmap.Config.ARGB_8888);val canvas=Canvas(b);val paint=Paint(Paint.ANTI_ALIAS_FLAG)
    paint.color=c.line;canvas.drawRoundRect(0f,0f,300f,12f,6f,6f,paint)
    paint.color=c.accent;canvas.drawRoundRect(0f,0f,300f*value.coerceIn(0f,1f),12f,6f,6f,paint);return b
  }
  private fun check(c:OrvimWidgetTheme,done:Boolean):Bitmap {
    val b=Bitmap.createBitmap(48,48,Bitmap.Config.ARGB_8888);val canvas=Canvas(b);val p=Paint(Paint.ANTI_ALIAS_FLAG)
    p.color=if(done)c.accent else c.muted;p.style=if(done)Paint.Style.FILL else Paint.Style.STROKE;p.strokeWidth=2.8f;canvas.drawCircle(24f,24f,19f,p)
    if(done){p.style=Paint.Style.STROKE;p.color=c.soft;p.strokeWidth=3f;p.strokeCap=Paint.Cap.ROUND;p.strokeJoin=Paint.Join.ROUND;val path=Path();path.moveTo(15f,24f);path.lineTo(21f,30f);path.lineTo(33f,18f);canvas.drawPath(path,p)}
    return b
  }
  fun checkIcon(context:Context,done:Boolean)=check(colors(context),done)
  fun resetScroll(context:Context,id:Int){preferences(context).edit().remove("scroll-date-$id").apply();refresh(context)}

}

open class OrvimWidgetProvider:AppWidgetProvider(){
  override fun onUpdate(context:Context,manager:AppWidgetManager,ids:IntArray){for(id in ids)OrvimWidgets.render(context,manager,id,javaClass)}
  override fun onAppWidgetOptionsChanged(context:Context,manager:AppWidgetManager,id:Int,options:Bundle){OrvimWidgets.render(context,manager,id,javaClass)}
  override fun onReceive(context:Context,intent:Intent){
    val pending=goAsync()
    val app=context.applicationContext
    val provider=javaClass
    Thread{try{
      val manager=AppWidgetManager.getInstance(app)
      val ids=intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS) ?: manager.getAppWidgetIds(ComponentName(app,provider))
      for(id in ids)OrvimWidgets.render(app,manager,id,provider)
    }catch(error:Exception){android.util.Log.e("OrvimWidget","Widget update failed",error)}finally{pending.finish()}}.start()
  }
}
class OrvimDayWidget:OrvimWidgetProvider()
class OrvimFoodWidget:OrvimWidgetProvider()
class OrvimThoughtWidget:OrvimWidgetProvider()
