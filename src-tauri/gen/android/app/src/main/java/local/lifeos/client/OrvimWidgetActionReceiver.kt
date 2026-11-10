package local.lifeos.client

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.appwidget.AppWidgetManager
import android.widget.RemoteViews
import org.json.JSONObject

class OrvimWidgetActionReceiver:BroadcastReceiver(){
  override fun onReceive(context:Context,intent:Intent){
    val payload=OrvimWidgets.takeAction(context,intent) ?: return
    val pending=goAsync()
    Thread{
      try{
        when(payload.optString("action")){
          "home" -> OrvimWidgets.resetScroll(context,intent.getIntExtra("widgetId",0))
          "rows" -> {
            val raw=intent.getStringExtra("widgetRowAction") ?: return@Thread
            require(raw.length<=1000)
            val action=JSONObject(raw)
            require(action.optString("action")=="complete" && action.optString("kind") in listOf("task","event"))
            OrvimWidgets.enqueue(context,listOf(action))
          }
          "complete" -> OrvimWidgets.enqueue(context,listOf(payload))
        }
      }catch(_:Exception){
        val id=intent.getIntExtra("widgetId",0)
        if(id>0){val views=RemoteViews(context.packageName,R.layout.widget_day);views.setTextViewText(R.id.widget_empty,if(OrvimWidgetLanguage.english(context))"Not saved. Open Orvim and try again." else "Не сохранено. Откройте Orvim и повторите.");views.setViewVisibility(R.id.widget_empty,android.view.View.VISIBLE);AppWidgetManager.getInstance(context).partiallyUpdateAppWidget(id,views)}
      }finally{pending.finish()}
    }.start()
  }
}
