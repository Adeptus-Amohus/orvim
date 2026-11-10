package local.lifeos.client

import android.app.Activity
import android.app.Instrumentation
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.widget.EditText
import android.widget.ListView
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.*
import androidx.test.espresso.matcher.ViewMatchers.*
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime

@RunWith(AndroidJUnit4::class)
class WidgetNativeTest {
  private val instrumentation get()=InstrumentationRegistry.getInstrumentation()
  private val context get()=instrumentation.targetContext
  private fun viewId(name:String)=context.resources.getIdentifier(name,"id",context.packageName)
  private fun inside(root:View,name:String):View? {
    if(root.id!=View.NO_ID && runCatching{root.resources.getResourceEntryName(root.id)}.getOrNull()==name)return root
    if(root is android.view.ViewGroup)for(i in 0 until root.childCount){val found=inside(root.getChildAt(i),name);if(found!=null)return found}
    return null
  }
  private fun awaitPending(){val until=System.currentTimeMillis()+6000;while(OrvimWidgets.pending(context).length()==0 && System.currentTimeMillis()<until)Thread.sleep(80)}
  private fun uiText(view:View):String {
    val own=if(view is android.widget.TextView)view.text.toString()+" (enabled="+view.isEnabled+")" else ""
    return own+if(view is android.view.ViewGroup)(0 until view.childCount).joinToString("\n"){uiText(view.getChildAt(it))}else ""
  }
  private fun projection():JSONObject {
    val today=LocalDate.now().toString()
    val start=String.format(java.util.Locale.US,"%02d:00",LocalDateTime.now().hour)
    return JSONObject().put("version",1).put("language","ru").put("dayStartMinutes",0).put("days",JSONArray().put(JSONObject().put("date",today).put("foodTarget",2200).put("calories",100).put("total",1).put("items",JSONArray().put(JSONObject().put("id",42).put("kind","task").put("title","20k steps — native test").put("start",start).put("end","").put("done",false)))))
  }
  private fun open(mode:String,edit:JSONObject?=null):Activity {
    OrvimWidgets.launch(context,999,mode)
    val token=context.getSharedPreferences("orvim_widgets",android.content.Context.MODE_PRIVATE).getString("intent-token",null)
    val intent=Intent(context,OrvimWidgetCaptureActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      .putExtra("orvimWidgetToken",token).putExtra("orvimWidgetAction",JSONObject().put("action",mode).toString())
    if(edit!=null)intent.putExtra("widgetEditItem",edit.toString())
    instrumentation.uiAutomation.adoptShellPermissionIdentity("android.permission.START_ACTIVITIES_FROM_BACKGROUND")
    try{return instrumentation.startActivitySync(intent)}finally{instrumentation.uiAutomation.dropShellPermissionIdentity()}
  }
  private fun clearJournal(){val rows=OrvimWidgets.pending(context);OrvimWidgets.ack(context,JSONArray((0 until rows.length()).map{rows.getJSONObject(it).getString("key")}))}
  @Test fun editScheduledTaskWithoutOpeningMain(){
    clearJournal();OrvimWidgets.save(context,projection())
    open("item",JSONObject().put("id",42).put("kind","task"))
    onView(withContentDescription("Название")).perform(replaceText("Edited from widget"),closeSoftKeyboard())
    onView(withContentDescription("Длительность")).perform(replaceText("75"),closeSoftKeyboard())
    screenshot("schedule-editor")
    onView(withText("Сохранить")).perform(scrollTo(),click());awaitPending()
    val command=OrvimWidgets.pending(context).getJSONObject(0)
    assertEquals("edit",command.getString("action"));assertEquals(75,command.getInt("duration"))
    val row=OrvimWidgets.rows(OrvimWidgets.day(OrvimWidgets.read(context),LocalDate.now().toString())).first{it.optLong("id")==42L}
    assertEquals("Edited from widget",row.getString("title"));assertEquals(75,row.getInt("duration"))
    clearJournal()
  }
  private fun screenshot(name:String){
    val bitmap=instrumentation.uiAutomation.takeScreenshot()
    val folder=context.getExternalFilesDir("widget-qa")!!;folder.mkdirs()
    File(folder,"$name.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
  }
  @Test fun englishOverridesRussianLocale(){
    val previous=java.util.Locale.getDefault()
    var activity:Activity?=null
    try{
      java.util.Locale.setDefault(java.util.Locale.forLanguageTag("ru-RU"))
      OrvimWidgets.save(context,projection().put("language","en"))
      val editor=open("item",JSONObject().put("id",42).put("kind","task"));activity=editor
      assertEquals("en",editor.resources.configuration.locales[0].language)
      assertEquals("Cancel",editor.getString(android.R.string.cancel))
      onView(withContentDescription("Date")).perform(click())
      onView(withText("Cancel")).perform(click())
      assertFalse(uiText(editor.window.decorView),Regex("[А-Яа-яЁё]").containsMatchIn(uiText(editor.window.decorView)))
      instrumentation.runOnMainSync{editor.finish()}
      activity=open("food")
      onView(withHint("What did you eat?")).perform(replaceText("Banana"),closeSoftKeyboard())
      Thread.sleep(800)
      onView(withText("Estimate with AI")).perform(scrollTo(),click())
      Thread.sleep(1500)
      onView(withText("Choose an AI model in Orvim settings.")).check(androidx.test.espresso.assertion.ViewAssertions.matches(isDisplayed()))
      screenshot("english-widget-food")
    }finally{
      activity?.let{owner->instrumentation.runOnMainSync{owner.finish()}}
      java.util.Locale.setDefault(previous);OrvimWidgets.save(context,projection())
    }
  }
  @Test fun compactFoodAndThoughtFitTwoRows(){
    clearJournal();val data=projection()
    data.getJSONArray("days").getJSONObject(0).put("calories",858).put("foodTarget",2600)
    OrvimWidgets.save(context,data);val activity=open("thought")
    val manager=AppWidgetManager.getInstance(context);val host=AppWidgetHost(context,38127);host.startListening()
    val views=mutableListOf<android.appwidget.AppWidgetHostView>()
    try{
      val stack=android.widget.LinearLayout(activity).apply{orientation=android.widget.LinearLayout.VERTICAL}
      instrumentation.runOnMainSync{
        activity.setContentView(stack);val scale=context.resources.displayMetrics.density
        activity.window.setLayout((156*scale).toInt(),(144*scale).toInt())
      }
      for(provider in listOf(OrvimFoodWidget::class.java,OrvimThoughtWidget::class.java)){
        val id=host.allocateAppWidgetId();assertTrue(manager.bindAppWidgetIdIfAllowed(id,ComponentName(context,provider)))
        val info=manager.getAppWidgetInfo(id)
        assertEquals("A widget must reserve only one launcher row",1,info.targetCellHeight)
        if(provider==OrvimFoodWidget::class.java)assertEquals(android.appwidget.AppWidgetProviderInfo.RESIZE_NONE,info.resizeMode)
        instrumentation.runOnMainSync{
          val view=host.createView(context,id,info);views.add(view)
          view.updateAppWidgetSize(null,156,72,156,72)
          stack.addView(view,android.widget.LinearLayout.LayoutParams(-1,(72*context.resources.displayMetrics.density).toInt()))
        }
        OrvimWidgets.render(context,manager,id,provider)
      }
      Thread.sleep(1600)
      instrumentation.runOnMainSync{
        val food=inside(views[0],"widget_root")!!;val foodBounds=android.graphics.Rect();assertTrue(food.getGlobalVisibleRect(foodBounds))
        for(name in listOf("widget_title","widget_calories","widget_calorie_goal","widget_calorie_bar","widget_add_food")){
          val child=inside(views[0],name)!!;val visible=android.graphics.Rect()
          assertTrue("Missing $name",child.getGlobalVisibleRect(visible));assertTrue("Clipped $name",visible.height()>=child.height)
          assertTrue("Outside nutrition frame: $name",foodBounds.contains(visible))
        }
        fun bounds(name:String)=android.graphics.Rect().also{inside(views[0],name)!!.getGlobalVisibleRect(it)}
        val title=bounds("widget_title");val calories=bounds("widget_calories");val goal=bounds("widget_calorie_goal");val bar=bounds("widget_calorie_bar")
        assertTrue("Calories belong below the title",calories.top>=title.bottom)
        assertTrue("Target belongs below calories",goal.top>=calories.bottom)
        assertTrue("Progress belongs below the target",bar.top>=goal.bottom)
        val add=inside(views[0],"widget_add_food")!!;val addBounds=bounds("widget_add_food")
        assertTrue("Use a geometric icon instead of a font glyph",add is android.widget.ImageView)
        assertTrue("Plus must stay vertically centered",kotlin.math.abs(addBounds.exactCenterY()-foodBounds.exactCenterY())<=1f)
        val caloriesView=inside(views[0],"widget_calories")!!
        assertTrue("Reserve space between the numbers and plus",calories.right-caloriesView.paddingEnd<=addBounds.left)
        val thought=android.graphics.Rect();inside(views[1],"widget_thought_pill")!!.getGlobalVisibleRect(thought)
        assertTrue("Thought must fit below nutrition",thought.top>=foodBounds.bottom)
      }
      screenshot("food-and-thought-one-row-each")
      val monitor=instrumentation.addMonitor(OrvimWidgetCaptureActivity::class.java.name,null,false)
      try{
        instrumentation.runOnMainSync{inside(views[0],"widget_add_food")!!.performClick()}
        val editor=instrumentation.waitForMonitorWithTimeout(monitor,6000)
        assertNotNull("The plus must open the quick food editor",editor)
        instrumentation.runOnMainSync{editor?.finish()}
      }finally{instrumentation.removeMonitor(monitor)}
    }finally{host.stopListening();host.deleteHost();instrumentation.runOnMainSync{activity.finish()}}
  }
  @Test fun tappingTimelineBlockOpensEditor(){
    clearJournal();OrvimWidgets.save(context,projection());val activity=open("thought")
    val manager=AppWidgetManager.getInstance(context);val host=AppWidgetHost(context,38126);host.startListening()
    val monitor=instrumentation.addMonitor(OrvimWidgetCaptureActivity::class.java.name,null,false)
    try{
      val id=host.allocateAppWidgetId();assertTrue(manager.bindAppWidgetIdIfAllowed(id,ComponentName(context,OrvimDayWidget::class.java)))
      var view:android.appwidget.AppWidgetHostView?=null
      instrumentation.runOnMainSync{
        view=host.createView(context,id,manager.getAppWidgetInfo(id));view!!.updateAppWidgetSize(null,320,470,320,470)
        activity.setContentView(view);val density=context.resources.displayMetrics.density
        activity.window.setLayout((320*density).toInt(),(470*density).toInt())
      }
      OrvimWidgets.render(context,manager,id,OrvimDayWidget::class.java);Thread.sleep(1800)
      instrumentation.runOnMainSync{(inside(view!!,"widget_timeline_list") as ListView).setSelection(LocalDateTime.now().hour)}
      Thread.sleep(500)
      instrumentation.runOnMainSync{assertNotNull(inside(view!!,"widget_hour_event"));inside(view!!,"widget_hour_event")!!.performClick()}
      val editor=instrumentation.waitForMonitorWithTimeout(monitor,6000)
      assertNotNull("Timeline tap must open the editor",editor)
      onView(withContentDescription("Название")).check(androidx.test.espresso.assertion.ViewAssertions.matches(withText("20k steps — native test")))
      onView(withContentDescription("Длительность")).perform(replaceText("45"),closeSoftKeyboard())
      screenshot("schedule-editor-real-tap")
      onView(withText("Сохранить")).perform(scrollTo(),click());awaitPending()
      assertEquals(45,OrvimWidgets.pending(context).getJSONObject(0).getInt("duration"))
    }finally{instrumentation.removeMonitor(monitor);host.stopListening();host.deleteHost();instrumentation.runOnMainSync{activity.finish()};clearJournal()}
  }
  @Test fun captureWithoutMainAndEncryptedJournal(){
    clearJournal();OrvimWidgets.save(context,projection())
    val activity=open("thought")
    onView(isAssignableFrom(EditText::class.java)).perform(replaceText("Native widget thought"),closeSoftKeyboard())
    Thread.sleep(600)
    onView(withText("+ Добавить")).perform(click())
    awaitPending()
    val pending=OrvimWidgets.pending(context)
    assertEquals(uiText(activity.window.decorView),1,pending.length());assertEquals("Native widget thought",pending.getJSONObject(0).getString("text"))
    assertTrue(activity.isFinishing)
    val file=File(context.applicationInfo.dataDir,"shared_prefs/orvim_widgets.xml")
    assertFalse(file.readText().contains("Native widget thought"))
    clearJournal()
  }
  @Test fun manualFoodValidationAndPersistence(){
    clearJournal();OrvimWidgets.save(context,projection());val activity=open("food")
    onView(withHint("Что вы съели?")).perform(replaceText("Banana"))
    onView(withHint("Калории, ккал")).perform(scrollTo(),replaceText("105"))
    onView(withHint("Белки, г")).perform(scrollTo(),replaceText("1.3"))
    onView(withHint("Жиры, г")).perform(scrollTo(),replaceText("0.4"))
    onView(withHint("Углеводы, г")).perform(scrollTo(),replaceText("27"),closeSoftKeyboard())
    Thread.sleep(600)
    screenshot("food-manual-macros")
    onView(withText("+ Добавить")).perform(scrollTo(),click());awaitPending()
    assertTrue(uiText(activity.window.decorView),OrvimWidgets.pending(context).length()>0)
    assertEquals(105.0,OrvimWidgets.pending(context).getJSONObject(0).getDouble("calories"),0.001)
    assertEquals(1.3,OrvimWidgets.pending(context).getJSONObject(0).getDouble("protein"),0.001)
    assertEquals(205.0,OrvimWidgets.day(OrvimWidgets.read(context),LocalDate.now().toString())!!.getDouble("calories"),0.001)
    clearJournal()
  }
  @Test fun estimateFieldsCanBeEditedAndMealRemoved(){
    clearJournal();OrvimWidgets.save(context,projection());val activity=open("food")
    val result=OrvimWidgetNutrition.parseEstimate("""{"items":[{"name":"Omelette","calories":250,"protein":18,"fat":16,"carbs":8},{"name":"Banana","calories":105,"protein":1.3,"fat":0.4,"carbs":27}]}""")
    instrumentation.runOnMainSync{
      val content=android.widget.LinearLayout(activity).apply{orientation=android.widget.LinearLayout.VERTICAL}
      activity.setContentView(android.widget.ScrollView(activity).apply{addView(content)})
      OrvimWidgetFoodEditor(activity,content,false).applyEstimate(result)
      activity.window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN)
      (activity.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).hideSoftInputFromWindow(activity.window.decorView.windowToken,0)
    }
    Thread.sleep(600)
    onView(withText("Banana")).perform(scrollTo(),replaceText("Banana corrected"))
    // Remove one result through the actual UI, leaving one editable meal.
    onView(org.hamcrest.Matchers.allOf(withContentDescription("Удалить блюдо"),hasSibling(withText("Omelette")))).perform(scrollTo(),click())
    onView(withHint("Калории, ккал")).perform(scrollTo(),replaceText("120"))
    Thread.sleep(600)
    screenshot("food-ai-edited")
    onView(withText("+ Добавить")).perform(scrollTo(),click());awaitPending()
    val rows=OrvimWidgets.pending(context)
    assertEquals(uiText(activity.window.decorView),1,rows.length())
    assertEquals("Banana corrected",rows.getJSONObject(0).getString("text"))
    assertEquals(120.0,rows.getJSONObject(0).getDouble("calories"),0.001)
    assertEquals(27.0,rows.getJSONObject(0).getDouble("carbs"),0.001)
    assertTrue(rows.getJSONObject(0).getBoolean("estimated"))
    clearJournal()
  }
  @Test fun malformedNutritionEstimateIsRejected(){
    for(raw in listOf("not JSON","""{"items":[{"name":"Unsafe","calories":100,"protein":-1,"fat":2,"carbs":3}]}""","""{"items":[{"name":"Missing macros","calories":100}]}""")){
      assertTrue(runCatching{OrvimWidgetNutrition.parseEstimate(raw)}.isFailure)
    }
  }
  @Test fun realHostScalingScrollingAndBackgroundCheck(){
    clearJournal();OrvimWidgets.save(context,projection())
    val activity=open("thought")
    val manager=AppWidgetManager.getInstance(context)
    val host=AppWidgetHost(context,38123);host.startListening()
    try{
      for((provider,name,size) in listOf(Triple(OrvimDayWidget::class.java,"day",340 to 470),Triple(OrvimDayWidget::class.java,"day-small",280 to 320),Triple(OrvimFoodWidget::class.java,"food",150 to 80),Triple(OrvimThoughtWidget::class.java,"thought",170 to 64))){
        clearJournal()
        val width=size.first;val height=size.second
        val id=host.allocateAppWidgetId()
        assertTrue("AppWidget bind permission is missing",manager.bindAppWidgetIdIfAllowed(id,ComponentName(context,provider)))
        var view:android.appwidget.AppWidgetHostView?=null
        instrumentation.runOnMainSync{
          // A launcher uses framework views. AppCompat's inflater substitutes
          // unannotated widgets that RemoteViews deliberately refuses to mutate.
          val widgetContext=android.view.ContextThemeWrapper(context,android.R.style.Theme_DeviceDefault_DayNight)
          view=host.createView(widgetContext,id,manager.getAppWidgetInfo(id))
          val scale=context.resources.displayMetrics.density
          view!!.updateAppWidgetSize(null,width,height,width,height)
          activity.setContentView(view)
          activity.window.setLayout((width*scale).toInt(),(height*scale).toInt())
        }
        OrvimWidgets.render(context,manager,id,provider)
        Thread.sleep(2200)
        instrumentation.runOnMainSync{
          val target=view!!
          val bitmap=Bitmap.createBitmap(maxOf(1,target.width),maxOf(1,target.height),Bitmap.Config.ARGB_8888)
          target.draw(Canvas(bitmap))
          val folder=context.getExternalFilesDir("widget-qa")!!;folder.mkdirs()
          File(folder,"$name-before.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
        }
        if(name.startsWith("day")){
          // Widget roots are view namespaces: Activity.findViewById deliberately
          // does not cross them. Inspect the hosted widget's actual subtree.
          val list=inside(view!!,"widget_timeline_list") as? ListView
          assertNotNull(list)
          assertEquals(24,list!!.count)
          instrumentation.runOnMainSync{list.setSelection(0)};Thread.sleep(300)
          assertEquals(0,list.firstVisiblePosition)
          instrumentation.runOnMainSync{list.setSelection(23)};Thread.sleep(300)
          assertTrue(list.firstVisiblePosition>0)
          instrumentation.runOnMainSync{inside(view!!,"widget_task_check")!!.performClick()}
          awaitPending()
          assertEquals("complete",OrvimWidgets.pending(context).getJSONObject(0).getString("action"))
          instrumentation.runOnMainSync{list.setSelection(LocalDateTime.now().hour)};Thread.sleep(300)
        }
        instrumentation.runOnMainSync{
          val target=view!!
          assertTrue(target.width>0 && target.height>0)
          val bitmap=Bitmap.createBitmap(target.width,target.height,Bitmap.Config.ARGB_8888)
          target.draw(Canvas(bitmap))
          val folder=context.getExternalFilesDir("widget-qa")!!;folder.mkdirs()
          File(folder,"$name.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
        }
        host.deleteAppWidgetId(id)
      }
      val action=JSONObject().put("action","complete").put("id",42).put("kind","task").put("done",false)
      OrvimWidgets.launch(context,999,"complete",action).send()
      Thread.sleep(700)
      assertTrue(OrvimWidgets.pending(context).length()>0)
    }finally{host.stopListening();host.deleteHost();instrumentation.runOnMainSync{activity.finish()};clearJournal()}
  }
  @Test fun allPalettesAndCompactWidgetSizes(){
    OrvimWidgets.save(context,projection());val activity=open("thought")
    val manager=AppWidgetManager.getInstance(context);val host=AppWidgetHost(context,38125);host.startListening()
    try{
      for(palette in listOf("sun","pine","scarlet","winter"))for(appearance in listOf("light","dark")){
        OrvimWidgets.save(context,projection().put("palette",palette).put("appearance",appearance))
        val theme=OrvimWidgetTheme.load(context)
        assertEquals(appearance=="dark",theme.dark)
        for((provider,name)in listOf(OrvimDayWidget::class.java to "day",OrvimThoughtWidget::class.java to "thought",OrvimFoodWidget::class.java to "food")){
          val id=host.allocateAppWidgetId();assertTrue(manager.bindAppWidgetIdIfAllowed(id,ComponentName(context,provider)))
          var view:android.appwidget.AppWidgetHostView?=null
          val height=if(name=="food")80 else 400
          instrumentation.runOnMainSync{
            view=host.createView(context,id,manager.getAppWidgetInfo(id));view!!.updateAppWidgetSize(null,320,height,320,height)
            activity.setContentView(view);val scale=context.resources.displayMetrics.density
            activity.window.setLayout((320*scale).toInt(),(height*scale).toInt())
          }
          OrvimWidgets.render(context,manager,id,provider);Thread.sleep(600)
          instrumentation.runOnMainSync{
            val title=inside(view!!,"widget_title") as android.widget.TextView
            assertEquals(theme.ink,title.currentTextColor)
            val scale=context.resources.displayMetrics.density
            if(name=="thought"){
              val pill=inside(view!!,"widget_thought_pill")!!
              assertEquals(48f,pill.height/scale,1f)
              assertTrue("Thought must span host width",pill.width/scale>=280)
              val drawable=pill.background as android.graphics.drawable.GradientDrawable
              assertEquals(230,android.graphics.Color.alpha(drawable.color!!.defaultColor))
            }
            if(name=="food")assertTrue(inside(view!!,"widget_root")!!.height/scale in 1f..80f)
            val bitmap=Bitmap.createBitmap(view!!.width,view!!.height,Bitmap.Config.ARGB_8888);view!!.draw(Canvas(bitmap))
            val folder=context.getExternalFilesDir("widget-theme-qa")!!;folder.mkdirs()
            File(folder,"$palette-$appearance-$name.png").outputStream().use{bitmap.compress(Bitmap.CompressFormat.PNG,100,it)}
          }
          host.deleteAppWidgetId(id)
        }
      }
    }finally{host.stopListening();host.deleteHost();instrumentation.runOnMainSync{activity.finish()};OrvimWidgets.save(context,projection())}
  }
}
