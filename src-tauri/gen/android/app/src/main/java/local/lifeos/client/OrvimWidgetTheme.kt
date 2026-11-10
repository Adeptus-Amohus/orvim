package local.lifeos.client

import android.content.Context
import android.content.res.Configuration
import android.content.res.ColorStateList
import android.graphics.Color
import android.widget.RemoteViews

/** Non-sensitive appearance cache: a thought widget never needs to decrypt user records. */
data class OrvimWidgetTheme(val dark:Boolean,val custom:Int?,val baseAccent:Int,val baseSoft:Int,val baseText:Int,val surfaceRes:Int,val softRes:Int,val thoughtRes:Int){
  val ink=Color.parseColor(if(dark)"#f3f5f7" else "#171b20")
  val muted=Color.parseColor(if(dark)"#acb7c1" else "#606a74")
  val line=Color.parseColor(if(dark)"#363d44" else "#d7dde3")
  val surface=Color.parseColor(if(dark)"#1c2025" else "#ffffff")
  val accent=custom ?: baseAccent
  val soft=if(custom==null)baseSoft else mix(surface,custom,0.16f)
  val accentText=if(custom==null)baseText else mix(ink,custom,0.35f)
  fun resourceColor(id:Int)=when(id){R.color.widget_ink->ink;R.color.widget_muted->muted;R.color.widget_tint->soft;R.color.widget_surface->surface;else->ink}
  fun background(views:RemoteViews,id:Int,kind:String){
    views.setInt(id,"setBackgroundResource",when(kind){"soft"->softRes;"thought"->thoughtRes;else->surfaceRes})
    if(custom!=null && android.os.Build.VERSION.SDK_INT>=31){
      val tint=when(kind){"soft"->soft;"thought"->(soft and 0x00ffffff) or (230 shl 24);else->surface}
      views.setColorStateList(id,"setBackgroundTintList",ColorStateList.valueOf(tint))
    }else if(android.os.Build.VERSION.SDK_INT>=31)views.setColorStateList(id,"setBackgroundTintList",null as ColorStateList?)
  }
  companion object{
    private fun color(value:String)=Color.parseColor(value)
    private fun mix(a:Int,b:Int,t:Float)=Color.rgb((Color.red(a)*(1-t)+Color.red(b)*t).toInt(),(Color.green(a)*(1-t)+Color.green(b)*t).toInt(),(Color.blue(a)*(1-t)+Color.blue(b)*t).toInt())
    fun load(context:Context):OrvimWidgetTheme{
      val prefs=context.getSharedPreferences("orvim_widgets",Context.MODE_PRIVATE)
      val dark=when(prefs.getString("appearance","system")){"dark"->true;"light"->false;else->context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK==Configuration.UI_MODE_NIGHT_YES}
      val palette=prefs.getString("palette","sun")
      val custom=if(palette=="custom")runCatching{color(prefs.getString("customColor","#8c6ad8")!!)}.getOrNull()else null
      val key=(if(palette in listOf("sun","pine","scarlet","winter"))palette else "sun")+"_"+if(dark)"dark" else "light"
      return when(key){
        "sun_light" -> OrvimWidgetTheme(dark,custom,color("#d99c00"),color("#fff4d5"),color("#946000"),R.drawable.widget_sun_light_surface,R.drawable.widget_sun_light_soft,R.drawable.widget_sun_light_thought)
        "sun_dark" -> OrvimWidgetTheme(dark,custom,color("#ffca4d"),color("#3b3321"),color("#ffca4d"),R.drawable.widget_sun_dark_surface,R.drawable.widget_sun_dark_soft,R.drawable.widget_sun_dark_thought)
        "pine_light" -> OrvimWidgetTheme(dark,custom,color("#177b51"),color("#e8f3ec"),color("#166a47"),R.drawable.widget_pine_light_surface,R.drawable.widget_pine_light_soft,R.drawable.widget_pine_light_thought)
        "pine_dark" -> OrvimWidgetTheme(dark,custom,color("#68c596"),color("#23372c"),color("#68c596"),R.drawable.widget_pine_dark_surface,R.drawable.widget_pine_dark_soft,R.drawable.widget_pine_dark_thought)
        "scarlet_light" -> OrvimWidgetTheme(dark,custom,color("#dc393d"),color("#fdeceb"),color("#bd292d"),R.drawable.widget_scarlet_light_surface,R.drawable.widget_scarlet_light_soft,R.drawable.widget_scarlet_light_thought)
        "scarlet_dark" -> OrvimWidgetTheme(dark,custom,color("#ff7779"),color("#3c2425"),color("#ff7779"),R.drawable.widget_scarlet_dark_surface,R.drawable.widget_scarlet_dark_soft,R.drawable.widget_scarlet_dark_thought)
        "winter_light" -> OrvimWidgetTheme(dark,custom,color("#1684b6"),color("#e9f5fb"),color("#146786"),R.drawable.widget_winter_light_surface,R.drawable.widget_winter_light_soft,R.drawable.widget_winter_light_thought)
        "winter_dark" -> OrvimWidgetTheme(dark,custom,color("#82d5f2"),color("#223846"),color("#82d5f2"),R.drawable.widget_winter_dark_surface,R.drawable.widget_winter_dark_soft,R.drawable.widget_winter_dark_thought)
        else -> error("Unknown widget theme")
      }
    }
  }
}
