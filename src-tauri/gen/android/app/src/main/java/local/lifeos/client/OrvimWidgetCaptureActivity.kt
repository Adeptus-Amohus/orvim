package local.lifeos.client

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Locale

/** A small launcher-owned entry window. It never instantiates Tauri or MainActivity. */
class OrvimWidgetCaptureActivity:AppCompatActivity(){
  override fun attachBaseContext(base:Context){
    val language=base.getSharedPreferences("orvim_widgets",Context.MODE_PRIVATE).getString("language",null)
    if(language in listOf("en","ru")){
      val configuration=android.content.res.Configuration(base.resources.configuration)
      configuration.setLocale(Locale.forLanguageTag(language!!))
      super.attachBaseContext(base.createConfigurationContext(configuration))
    }else super.attachBaseContext(base)
  }
  private lateinit var content:LinearLayout
  private lateinit var error:TextView
  private lateinit var save:Button
  private var closed=false
  private var selectedDate=LocalDate.now()
  private var selectedTime=""
  private var mode="thought"
  private var en=false
  private fun t(ru:String,english:String)=if(en)english else ru
  private fun dp(value:Int)=(value*resources.displayMetrics.density).toInt()
  private val widgetTheme by lazy { OrvimWidgetTheme.load(this) }
  private fun widgetColor(id:Int)=widgetTheme.resourceColor(id)
  private fun ink()=widgetTheme.ink
  private fun label(text:String,size:Float=14f)=TextView(this).apply{this.text=text;textSize=size;setTextColor(ink());setPadding(0,dp(8),0,dp(8))}
  private fun button(text:String)=Button(this).apply{this.text=text;isAllCaps=false;stateListAnimator=null;elevation=0f;textSize=13f;minHeight=dp(44);setTextColor(ink());background=GradientDrawable().apply{setColor(widgetColor(R.color.widget_tint));cornerRadius=dp(22).toFloat()}}
  private fun field(hint:String,numeric:Boolean=false)=EditText(this).apply{
    this.hint=hint;textSize=16f;setTextColor(ink());setHintTextColor(widgetColor(R.color.widget_muted));setPadding(dp(12),dp(12),dp(12),dp(12))
    filters=arrayOf(InputFilter.LengthFilter(if(numeric)8 else 10000))
    inputType=if(numeric)InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
    minHeight=dp(48);maxLines=if(numeric)1 else 5
    background=GradientDrawable().apply{setColor(Color.TRANSPARENT);setStroke(dp(1),widgetColor(R.color.widget_muted));cornerRadius=dp(12).toFloat()}
  }
  override fun onCreate(state:Bundle?){
    super.onCreate(state)
    val action=OrvimWidgets.takeAction(this,intent)
    if(action==null || action.optString("action") !in listOf("task","thought","food","item")){finish();return}
    mode=action.optString("action")
    en=OrvimWidgetLanguage.english(this)
    content=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(20),dp(12),dp(20),dp(20))}
    val scroll=ScrollView(this).apply{isFillViewport=false;addView(content)}
    setContentView(scroll)
    window.setBackgroundDrawable(GradientDrawable().apply{setColor(widgetTheme.surface);cornerRadius=dp(24).toFloat()})
    window.setLayout(minOf(resources.displayMetrics.widthPixels-dp(32),dp(440)),WindowManager.LayoutParams.WRAP_CONTENT)
    window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
    val head=LinearLayout(this).apply{gravity=Gravity.CENTER_VERTICAL}
    head.addView(ImageView(this).apply{setImageResource(R.mipmap.ic_launcher)},LinearLayout.LayoutParams(dp(28),dp(28)))
    head.addView(label(when(mode){"task"->t("Новая задача","New task");"food"->t("Записать еду","Log food");else->t("Записать мысль","Write a thought")},18f),LinearLayout.LayoutParams(0,dp(54),1f).apply{marginStart=dp(10)})
    head.addView(button("×").apply{contentDescription=t("Закрыть","Close");setOnClickListener{finish()}},LinearLayout.LayoutParams(dp(44),dp(44)))
    content.addView(head)
    if(mode=="item"){
      (head.getChildAt(1) as TextView).text=t("Изменить задачу","Edit task")
      OrvimWidgetScheduleEditor(this,content,en,intent.getStringExtra("widgetEditItem"))
      return
    }
    if(mode=="food"){
      OrvimWidgetFoodEditor(this,content,en)
      window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
      return
    }
    val text=field(when(mode){"food"->t("Что вы съели?","What did you eat?");"task"->t("Что нужно сделать?","What needs doing?");else->t("Текст мысли","Your thought")})
    text.minLines=if(mode=="thought")3 else 2
    content.addView(text)
    if(mode=="task"){
      val controls=LinearLayout(this)
      val date=button(selectedDate.toString());val time=button(t("Без времени","No time"))
      date.setOnClickListener{DatePickerDialog(this,{_,y,m,d->selectedDate=LocalDate.of(y,m+1,d);date.text=selectedDate.toString()},selectedDate.year,selectedDate.monthValue-1,selectedDate.dayOfMonth).show()}
      time.setOnClickListener{TimePickerDialog(this,{_,h,m->selectedTime=String.format(Locale.US,"%02d:%02d",h,m);time.text=selectedTime},LocalDateTime.now().hour,0,true).show()}
      controls.addView(date,LinearLayout.LayoutParams(0,dp(44),1f));controls.addView(time,LinearLayout.LayoutParams(0,dp(44),1f).apply{marginStart=dp(8)})
      content.addView(controls,LinearLayout.LayoutParams(-1,dp(52)).apply{topMargin=dp(8)})
    }
    error=label("",12f);error.setTextColor(widgetColor(R.color.widget_muted));content.addView(error)
    save=button(t("+ Добавить","+ Add"))
    save.setOnClickListener{
      val body=text.text.toString().trim()
      if(body.isEmpty()){text.error=t("Введите текст","Enter text");return@setOnClickListener}
      val at=System.currentTimeMillis()
      val row=JSONObject().put("action",mode).put("text",body).put("date",selectedDate.toString()).put("at",at)
      if(mode=="task")row.put("time",selectedTime)
      val rows=listOf(row)
      save.isEnabled=false
      Thread{
        try{OrvimWidgets.enqueue(this,rows);runOnUiThread{if(!closed){Toast.makeText(this,t("Сохранено","Saved"),Toast.LENGTH_SHORT).show();finish()}}}
        catch(cause:Exception){runOnUiThread{if(!closed){save.isEnabled=true;error.text=cause.message?.let{OrvimWidgetLanguage.message(this,it)} ?: t("Не сохранено. Повторите.","Not saved. Try again.")}}}
      }.start()
    }
    content.addView(save,LinearLayout.LayoutParams(-1,dp(46)))
    text.requestFocus()
    window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
  }
  override fun onDestroy(){closed=true;super.onDestroy()}
}
