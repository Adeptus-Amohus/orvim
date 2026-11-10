package local.lifeos.client

import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import org.json.JSONObject
import java.time.LocalDate
import java.util.Locale

class OrvimWidgetListService:RemoteViewsService(){
  override fun onGetViewFactory(intent:Intent):RemoteViewsFactory=Factory(applicationContext,intent.getStringExtra("section") ?: "hours")
  internal class Factory(val context:Context,val section:String):RemoteViewsFactory {
    private var items=emptyList<JSONObject>()
    private var checked:android.graphics.Bitmap?=null
    private var unchecked:android.graphics.Bitmap?=null
    private var theme=OrvimWidgetTheme.load(context)
    // Android calls onCreate on the service's main thread. Crypto and data
    // loading belong in the adapter's worker callback, never in this method.
    override fun onCreate(){}
    override fun onDataSetChanged(){items=OrvimWidgets.rows(OrvimWidgets.day(OrvimWidgets.read(context),LocalDate.now().toString())).sortedBy{it.optBoolean("done")};theme=OrvimWidgetTheme.load(context);checked=OrvimWidgets.checkIcon(context,true);unchecked=OrvimWidgets.checkIcon(context,false)}
    override fun onDestroy(){}
    override fun getCount()=if(section=="hours")24 else items.size
    override fun getViewTypeCount()=1
    override fun getItemId(position:Int)=position.toLong()
    override fun hasStableIds()=false
    override fun getLoadingView():RemoteViews?=null
    override fun getViewAt(position:Int):RemoteViews {
      if(section=="tasks"){
        val row=RemoteViews(context.packageName,R.layout.widget_task_row)
        val item=items.getOrNull(position) ?: JSONObject()
        row.setTextViewText(R.id.widget_task_text,item.optString("title"))
        row.setTextColor(R.id.widget_task_text,theme.ink)
        row.setImageViewBitmap(R.id.widget_task_check,if(item.optBoolean("done"))checked else unchecked)
        val action=JSONObject().put("action","complete").put("id",item.optLong("id")).put("kind",item.optString("kind")).put("done",!item.optBoolean("done")).put("date",LocalDate.now().toString())
        if(item.has("operation"))action.put("targetOperation",item.optString("operation"))
        row.setOnClickFillInIntent(R.id.widget_task_check,Intent().putExtra("widgetRowAction",action.toString()))
        val en=OrvimWidgetLanguage.english(context)
        row.setContentDescription(R.id.widget_task_check,(if(item.optBoolean("done")){if(en)"Undo: " else "Вернуть: "}else{if(en)"Complete: " else "Выполнить: "})+item.optString("title"))
        return row
      }
      val row=RemoteViews(context.packageName,R.layout.widget_hour)
      row.setTextViewText(R.id.widget_hour_label,String.format(Locale.US,"%02d:00",position))
      row.setTextColor(R.id.widget_hour_label,theme.muted)
      row.setInt(R.id.widget_hour_line,"setBackgroundColor",theme.line)
      row.removeAllViews(R.id.widget_hour_content)
      for(item in items.filter{it.optString("start").take(2).toIntOrNull()==position}){
        val block=RemoteViews(context.packageName,R.layout.widget_hour_event)
        val time=item.optString("start")+(if(item.optString("end").isNotEmpty())"–"+item.optString("end") else "")
        block.setTextViewText(R.id.widget_hour_event,(if(item.optBoolean("done"))"✓ " else "")+item.optString("title")+"\n"+time)
        theme.background(block,R.id.widget_hour_event,"soft")
        block.setTextColor(R.id.widget_hour_event,theme.ink)
        val edit=JSONObject().put("id",item.optLong("id")).put("kind",item.optString("kind"))
        if(item.has("operation"))edit.put("targetOperation",item.optString("operation"))
        block.setOnClickFillInIntent(R.id.widget_hour_event,Intent().putExtra("widgetEditItem",edit.toString()))
        row.addView(R.id.widget_hour_content,block)
      }
      return row
    }
  }
}
