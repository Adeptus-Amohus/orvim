package local.lifeos.client

import android.app.Activity
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.graphics.drawable.GradientDrawable
import android.text.InputType
import android.widget.*
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalTime

/** Edits only an existing projected record; a launcher cannot invent a database ID. */
class OrvimWidgetScheduleEditor(val activity:Activity,val content:LinearLayout,val en:Boolean,raw:String?){
  private fun t(ru:String,enText:String)=if(en)enText else ru
  private fun dp(v:Int)=(v*activity.resources.displayMetrics.density).toInt()
  private val theme=OrvimWidgetTheme.load(activity)
  private fun field(value:String,numeric:Boolean=false)=EditText(activity).apply{
    setText(value);setTextColor(theme.ink);textSize=16f;minHeight=dp(48)
    inputType=if(numeric)InputType.TYPE_CLASS_NUMBER else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
    setPadding(dp(12),dp(8),dp(12),dp(8))
    background=GradientDrawable().apply{setColor(theme.surface);setStroke(dp(1),theme.line);cornerRadius=dp(12).toFloat()}
  }
  private fun button(value:String)=Button(activity).apply{text=value;isAllCaps=false;stateListAnimator=null;setTextColor(theme.accentText);background=GradientDrawable().apply{setColor(theme.soft);cornerRadius=dp(22).toFloat()}}
  init{
    val ref=runCatching{require(raw!=null && raw.length<=1000);JSONObject(raw)}.getOrNull()
    var found:JSONObject?=null;var selectedDate=LocalDate.now()
    val days=OrvimWidgets.read(activity).optJSONArray("days")
    if(ref!=null && days!=null)for(i in 0 until days.length())for(item in OrvimWidgets.rows(days.getJSONObject(i))){
      if((ref.has("targetOperation") && item.optString("operation")==ref.optString("targetOperation")) || (!ref.has("targetOperation") && item.optLong("id")==ref.optLong("id") && item.optString("kind")==ref.optString("kind"))){found=item;selectedDate=LocalDate.parse(days.getJSONObject(i).getString("date"))}
    }
    if(found==null || ref==null){Toast.makeText(activity,t("Запись уже недоступна. Обновите виджет.","Record unavailable. Refresh the widget."),Toast.LENGTH_LONG).show();activity.finish()}
    else{
      val item=found!!;var selectedTime=runCatching{LocalTime.parse(item.optString("start"))}.getOrDefault(LocalTime.now().withSecond(0).withNano(0))
      val title=field(item.optString("title"));title.contentDescription=t("Название","Title");content.addView(title)
      val date=button(selectedDate.toString());val time=button(selectedTime.toString())
      date.contentDescription=t("Дата","Date");time.contentDescription=t("Начало","Start")
      date.setOnClickListener{DatePickerDialog(activity,{_,y,m,d->selectedDate=LocalDate.of(y,m+1,d);date.text=selectedDate.toString()},selectedDate.year,selectedDate.monthValue-1,selectedDate.dayOfMonth).show()}
      time.setOnClickListener{TimePickerDialog(activity,{_,h,m->selectedTime=LocalTime.of(h,m);time.text=selectedTime.toString()},selectedTime.hour,selectedTime.minute,true).show()}
      content.addView(date);content.addView(time)
      val end=runCatching{LocalTime.parse(item.optString("end"))}.getOrNull()
      val minutes=if(end!=null)((end.toSecondOfDay()-selectedTime.toSecondOfDay()+86400)%86400)/60 else item.optInt("duration",30)
      content.addView(TextView(activity).apply{text=t("Длительность, минут","Duration, minutes");setTextColor(theme.muted)})
      val duration=field(minutes.coerceAtLeast(1).toString(),true);duration.contentDescription=t("Длительность","Duration");content.addView(duration)
      val status=TextView(activity).apply{setTextColor(theme.muted)};content.addView(status)
      val save=button(t("Сохранить","Save"));content.addView(save)
      save.setOnClickListener{
        val name=title.text.toString().trim();val length=duration.text.toString().toIntOrNull()
        if(name.isEmpty() || name.length>180){title.error=t("Название: 1–180 символов","Title: 1–180 characters");return@setOnClickListener}
        if(length==null || length !in 1..1440){duration.error=t("От 1 до 1440 минут","From 1 to 1440 minutes");return@setOnClickListener}
        val command=JSONObject(ref.toString()).put("action","edit").put("text",name).put("date",selectedDate.toString()).put("time",selectedTime.toString()).put("duration",length).put("at",System.currentTimeMillis())
        save.isEnabled=false
        Thread{try{OrvimWidgets.enqueue(activity,listOf(command));activity.runOnUiThread{activity.finish()}}catch(_:Exception){activity.runOnUiThread{save.isEnabled=true;status.text=t("Не сохранено. Повторите.","Not saved. Try again.")}}}.start()
      }
    }
  }
}
