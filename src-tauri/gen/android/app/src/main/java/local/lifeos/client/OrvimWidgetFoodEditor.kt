package local.lifeos.client

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.widget.*
import org.json.JSONObject
import java.time.LocalDateTime

/** Editable meal drafts. AI fills these exact fields; nothing is saved implicitly. */
class OrvimWidgetFoodEditor(private val activity:Activity,private val content:LinearLayout,private val en:Boolean){
  private val theme=OrvimWidgetTheme.load(activity)
  private data class Meal(val view:LinearLayout,val name:EditText,val values:Map<String,EditText>,val remove:Button,val estimated:Boolean)
  private val meals=mutableListOf<Meal>()
  private val list=LinearLayout(activity).apply{orientation=LinearLayout.VERTICAL}
  private val status=TextView(activity)
  private val ai=button(t("Оценить с ИИ","Estimate with AI"))
  private val more=button(t("+ Ещё блюдо","+ Another meal"))
  private val save=button(t("+ Добавить","+ Add"))
  private var busy=false
  private fun t(ru:String,english:String)=if(en)english else ru
  private fun dp(value:Int)=(value*activity.resources.displayMetrics.density).toInt()
  private fun color(id:Int)=theme.resourceColor(id)
  private fun button(text:String)=Button(activity).apply{
    this.text=text;isAllCaps=false;stateListAnimator=null;elevation=0f;textSize=13f;setTextColor(color(R.color.widget_ink))
    background=GradientDrawable().apply{setColor(color(R.color.widget_tint));cornerRadius=dp(22).toFloat()}
  }
  private fun field(hint:String,numeric:Boolean=false)=EditText(activity).apply{
    this.hint=hint;textSize=if(numeric)14f else 16f
    setTextColor(color(R.color.widget_ink));setHintTextColor(color(R.color.widget_muted));setPadding(dp(10),dp(8),dp(10),dp(8))
    inputType=if(numeric)InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL else InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
    filters=arrayOf(InputFilter.LengthFilter(if(numeric)8 else 1000));minHeight=dp(48);maxLines=if(numeric)1 else 4
    background=GradientDrawable().apply{setColor(Color.TRANSPARENT);setStroke(dp(1),color(R.color.widget_muted));cornerRadius=dp(12).toFloat()}
  }
  init{
    content.addView(ai,LinearLayout.LayoutParams(-1,dp(44)).apply{bottomMargin=dp(8)})
    content.addView(list)
    content.addView(more,LinearLayout.LayoutParams(-1,dp(44)).apply{topMargin=dp(8)})
    status.textSize=12f;status.setTextColor(color(R.color.widget_muted));status.setPadding(0,dp(8),0,dp(8));content.addView(status)
    content.addView(save,LinearLayout.LayoutParams(-1,dp(46)))
    addMeal()
    more.setOnClickListener{if(meals.size<20)addMeal()else status.text=t("До 20 блюд за одно добавление","Up to 20 meals per entry")}
    ai.setOnClickListener{estimate()}
    save.setOnClickListener{commit()}
    meals.first().name.requestFocus()
  }
  private fun addMeal(data:JSONObject?=null){
    val card=LinearLayout(activity).apply{orientation=LinearLayout.VERTICAL;setPadding(0,dp(6),0,dp(10))}
    val head=LinearLayout(activity).apply{gravity=Gravity.CENTER_VERTICAL}
    val name=field(t("Что вы съели?","What did you eat?"))
    name.setText(data?.optString("text") ?: "")
    val remove=button("×").apply{contentDescription=t("Удалить блюдо","Remove meal")}
    head.addView(name,LinearLayout.LayoutParams(0,-2,1f));head.addView(remove,LinearLayout.LayoutParams(dp(40),dp(44)).apply{marginStart=dp(6)})
    card.addView(head)
    val labels=linkedMapOf("calories" to t("Калории, ккал","Calories, kcal"),"protein" to t("Белки, г","Protein, g"),"fat" to t("Жиры, г","Fat, g"),"carbs" to t("Углеводы, г","Carbs, g"))
    val fields=linkedMapOf<String,EditText>()
    for(pair in labels.entries.chunked(2)){
      val line=LinearLayout(activity)
      pair.forEachIndexed{index,entry->
        val input=field(entry.value,true)
        if(data?.has(entry.key)==true)input.setText(format(data.getDouble(entry.key)))
        fields[entry.key]=input
        val group=LinearLayout(activity).apply{orientation=LinearLayout.VERTICAL}
        group.addView(TextView(activity).apply{text=entry.value;textSize=12f;setTextColor(color(R.color.widget_muted));setPadding(dp(2),0,0,dp(4))})
        group.addView(input,LinearLayout.LayoutParams(-1,dp(48)))
        line.addView(group,LinearLayout.LayoutParams(0,-2,1f).apply{if(index>0)marginStart=dp(8)})
      }
      card.addView(line,LinearLayout.LayoutParams(-1,-2).apply{topMargin=dp(8)})
    }
    val meal=Meal(card,name,fields,remove,data!=null)
    meals.add(meal);list.addView(card)
    remove.setOnClickListener{if(!busy){list.removeView(card);meals.remove(meal);save.isEnabled=meals.isNotEmpty()}}
    if(!busy)save.isEnabled=true
  }
  private fun format(value:Double)=if(value%1.0==0.0)value.toLong().toString()else value.toString()
  private fun setBusy(value:Boolean){
    busy=value;ai.isEnabled=!value;more.isEnabled=!value;save.isEnabled=!value && meals.isNotEmpty()
    for(meal in meals){meal.name.isEnabled=!value;meal.remove.isEnabled=!value;meal.values.values.forEach{it.isEnabled=!value}}
  }
  private fun alive()=!activity.isFinishing && !activity.isDestroyed
  private fun estimate(){
    if(busy)return
    val description=meals.map{it.name.text.toString().trim()}.filter{it.isNotEmpty()}.joinToString("\n")
    if(description.isEmpty()){status.text=t("Сначала опишите еду и порции","Describe your food and portions first");return}
    if(description.length>10000){status.text=t("Сократите описание еды","Shorten the food description");return}
    setBusy(true);status.text=t("ИИ рассчитывает КБЖУ…","AI is estimating nutrition…")
    Thread{
      try{
        val result=OrvimWidgetNutrition.estimate(activity,description)
        activity.runOnUiThread{if(alive()){
          applyEstimate(result)
          status.text=t("Примерная оценка. Все поля можно исправить, лишние блюда — удалить.","Estimated. Edit any field or remove unwanted meals.")
          setBusy(false)
        }}
      }catch(cause:Exception){activity.runOnUiThread{if(alive()){setBusy(false);status.text=cause.message?.let{OrvimWidgetLanguage.message(activity,it)} ?: t("Не удалось оценить. Заполните вручную.","Could not estimate. Fill in manually.")}}}
    }.start()
  }
  internal fun applyEstimate(result:List<JSONObject>){
    meals.clear();list.removeAllViews();result.forEach{addMeal(it)}
  }
  private fun commit(){
    if(busy || meals.isEmpty())return
    val at=System.currentTimeMillis()
    val projection=OrvimWidgets.read(activity)
    val date=LocalDateTime.now().minusMinutes(projection.optLong("dayStartMinutes")).toLocalDate().toString()
    val rows=mutableListOf<JSONObject>()
    for(meal in meals){
      val name=meal.name.text.toString().trim()
      if(name.isEmpty() || name.length>180){meal.name.error=t("Название: от 1 до 180 символов","Use 1 to 180 characters");return}
      val row=JSONObject().put("action","food").put("text",name).put("date",date).put("at",at).put("estimated",meal.estimated)
      for((key,input)in meal.values){
        val text=input.text.toString().trim()
        if(text.isEmpty() && key!="calories")continue
        val number=text.replace(',','.').toDoubleOrNull()
        val limit=if(key=="calories")10000 else 2000
        if(number==null || !number.isFinite() || number<0 || number>limit){input.error=t("Число от 0 до $limit","Enter a number from 0 to $limit");return}
        row.put(key,number)
      }
      rows.add(row)
    }
    setBusy(true)
    Thread{try{
      OrvimWidgets.enqueue(activity,rows)
      activity.runOnUiThread{if(alive()){Toast.makeText(activity,t("Сохранено","Saved"),Toast.LENGTH_SHORT).show();activity.finish()}}
    }catch(cause:Exception){activity.runOnUiThread{if(alive()){setBusy(false);status.text=cause.message?.let{OrvimWidgetLanguage.message(activity,it)} ?: t("Не сохранено. Повторите.","Not saved. Try again.")}}}}.start()
  }
}
